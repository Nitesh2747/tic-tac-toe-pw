// Socket events about being in a room: create, join, leave, kick, disconnect.
import {
  createRoom,
  findJoinTarget,
  getRoom,
  getRoleOf,
  isBanned,
  joinRoom,
  kickPlayer,
  markDisconnected,
  getPublicState,
} from "../game/room.js";
import { isId } from "../lib/validate.js";
import { readProfile, readRoomSettings } from "../lib/profile.js";
import { createFailureLimiter } from "../lib/rateLimit.js";
import { getClientIp } from "../lib/clientIp.js";
import { scheduleLobbyUpdate } from "../lib/lobby.js";
import { addSystemMessage, announce } from "../lib/chat.js";
import { syncTurnTimer } from "../lib/turnTimer.js";
import {
  clearGraceTimer,
  startGraceTimer,
  leaveCurrentRoom,
} from "../lib/membership.js";
import {
  CODE_FAIL_WINDOW_MS,
  CODE_FAILS_PER_SOCKET,
  CODE_FAILS_PER_IP,
  ROOM_CREATES_PER_IP,
  ROOM_CREATE_WINDOW_MS,
} from "../config.js";

// Wrong private-room codes are limited per connection AND per IP address, so guessing codes is hopeless. A room itself is never locked, because that would let anyone lock a host's guests out just by spamming wrong codes.
const socketLimiter = createFailureLimiter({ limit: CODE_FAILS_PER_SOCKET, windowMs: CODE_FAIL_WINDOW_MS });
const ipLimiter = createFailureLimiter({ limit: CODE_FAILS_PER_IP, windowMs: CODE_FAIL_WINDOW_MS });
const createLimiter = createFailureLimiter({ limit: ROOM_CREATES_PER_IP, windowMs: ROOM_CREATE_WINDOW_MS });

// The secret code goes only to the people sitting in a private room.
function codeFor(room) {
  return room.visibility === "private" ? room.code : undefined;
}

export function registerRoomHandlers(io, socket) {
  socket.on("room:create", (payload, ack) => {
    if (typeof ack !== "function") return;
    const { playerId } = payload ?? {};
    if (!isId(playerId)) return ack({ ok: false, error: "Missing player id" });
    const profile = readProfile(payload);
    if (!profile.ok) return ack(profile);
    const settings = readRoomSettings(payload, profile.name);
    if (!settings.ok) return ack(settings);

    const ip = getClientIp(socket);
    const waitMs = createLimiter.retryAfterMs(ip);
    if (waitMs > 0) {
      return ack({ ok: false, error: `You are creating rooms too fast. Try again in ${Math.ceil(waitMs / 1000)} seconds` });
    }
    createLimiter.recordFailure(ip);

    leaveCurrentRoom(io, socket);

    const room = createRoom({
      name: settings.name,
      visibility: settings.visibility,
      turnSeconds: settings.turnSeconds,
    });
    if (!room) {
      return ack({ ok: false, error: "Server is busy, try again later" });
    }
    const role = joinRoom(room, playerId, socket.id, profile);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.playerId = playerId;
    console.log(`room ${room.id} (${room.visibility}) created, ${role} = ${socket.id}`);

    syncTurnTimer(io, room);
    ack({ ok: true, role, state: getPublicState(room), code: codeFor(room), chat: room.chat });
    if (room.visibility === "public") scheduleLobbyUpdate(io);
  });

  // Join by room id (a public room, or the room you already sit in) or by code (a private room).
  socket.on("room:join", (payload, ack) => {
    if (typeof ack !== "function") return;
    const { playerId, roomId, code } = payload ?? {};
    if (!isId(playerId)) return ack({ ok: false, error: "Missing player id" });
    const profile = readProfile(payload);
    if (!profile.ok) return ack(profile);

    const hasCode = code !== undefined && code !== null && code !== "";
    if (hasCode && !isId(code)) return ack({ ok: false, error: "No room found for that code" });
    if (!hasCode && !isId(roomId)) return ack({ ok: false, error: "Missing room" });

    // Check the limits BEFORE looking at the code, so that a blocked client cannot even tell whether a guess was right.
    const ip = getClientIp(socket);
    if (hasCode) {
      const waitMs = Math.max(socketLimiter.retryAfterMs(socket.id), ipLimiter.retryAfterMs(ip));
      if (waitMs > 0) {
        return ack({ ok: false, error: `Too many attempts. Try again in ${Math.ceil(waitMs / 1000)} seconds` });
      }
    }

    const target = findJoinTarget({ roomId, code }, playerId);
    if (target.error) {
      if (hasCode) {
        socketLimiter.recordFailure(socket.id);
        ipLimiter.recordFailure(ip);
      }
      return ack({ ok: false, error: target.error });
    }
    const room = target.room;

    const seated = getRoleOf(room, playerId) !== null;
    if (!seated && isBanned(room, playerId)) {
      return ack({ ok: false, error: "You were removed from this room" });
    }

    // Check there is a seat BEFORE leaving the old room, so a refused join does not cost the player the room they are already in. (Someone who already has a seat here, like a player refreshing the page, always gets it back.)
    if (!seated && room.players.X && room.players.O) {
      return ack({ ok: false, error: "Room is full" });
    }
    if (socket.data.roomId !== room.id) leaveCurrentRoom(io, socket);

    const wasSeated = getRoleOf(room, playerId) !== null;
    const hadChat = room.chat.length > 0;
    const role = joinRoom(room, playerId, socket.id, profile);
    if (!role) return ack({ ok: false, error: "Room is full" });

    clearGraceTimer(room.id, playerId); // they are back: keep the seat
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.playerId = playerId;
    console.log(`room ${room.id}: ${role} = ${socket.id}`);

    syncTurnTimer(io, room);
    if (!wasSeated) {
      if (hadChat && room.chat.length === 0) socket.to(room.id).emit("chat:history", { messages: [] });
      socket.to(room.id).emit("chat:message", addSystemMessage(room, `${profile.name} joined.`));
    }

    const state = getPublicState(room);
    ack({ ok: true, role, state, code: codeFor(room), chat: room.chat }); // reply to the joiner
    socket.to(room.id).emit("game:state", state); // tell everyone else in the room
    if (room.visibility === "public") scheduleLobbyUpdate(io);
  });

  socket.on("room:leave", (ack) => {
    leaveCurrentRoom(io, socket);
    if (typeof ack === "function") ack({ ok: true });
  });

  // The host removes the player in a seat ("X" or "O").
  socket.on("room:kick", (payload, ack) => {
    if (typeof ack !== "function") return;
    // Who is asking, and in which room, comes from the server, never from the client.
    const room = getRoom(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "You are not in a room" });

    const kickedName = room.players[payload?.seat]?.name;
    const result = kickPlayer(room, socket.data.playerId, payload?.seat);
    if (!result.ok) return ack(result);

    const { kicked } = result;
    clearGraceTimer(room.id, kicked.playerId);

    // Tell the removed player, and take their connection out of the room.
    const kickedSocket = io.sockets.sockets.get(kicked.socketId);
    if (kickedSocket && kickedSocket.data.playerId === kicked.playerId) {
      kickedSocket.leave(room.id);
      kickedSocket.data.roomId = null;
      kickedSocket.data.playerId = null;
      kickedSocket.emit("room:kicked", { message: "You were removed from the room by the host." });
    }
    console.log(`room ${room.id}: ${kicked.playerId.slice(0, 6)} was removed by the host`);

    ack({ ok: true });
    announce(io, room, `${kickedName} was removed by the host.`); // (the removed player has left the room already)
    syncTurnTimer(io, room); // a seat just emptied: the clock stops
    io.to(room.id).emit("game:state", getPublicState(room));
    // A private room's code was replaced: the player who stays needs the new one.
    if (room.visibility === "private") io.to(room.id).emit("room:code", { code: room.code });
    else scheduleLobbyUpdate(io);
  });

  // A dropped connection does not free the seat right away: the player gets RECONNECT_GRACE_MS to come back (refresh, flaky wifi) before it is freed.
  socket.on("disconnect", (reason) => {
    console.log("disconnected:", socket.id, reason);

    const { roomId, playerId } = socket.data;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room || !markDisconnected(room, playerId, socket.id)) return;

    syncTurnTimer(io, room); // a player dropped: pause the clock
    io.to(roomId).emit("game:state", getPublicState(room));
    startGraceTimer(io, roomId, playerId);
    // The room may have just become empty of online players: update the list.
    if (room.visibility === "public") scheduleLobbyUpdate(io);
  });
}
