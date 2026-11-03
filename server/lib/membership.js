// Who is in which room, and what happens when they leave or drop.
import { getRoom, getRoleOf, leaveRoom, getPublicState } from "../game/room.js";
import { announce } from "./chat.js";
import { RECONNECT_GRACE_MS } from "../config.js";
import { scheduleLobbyUpdate } from "./lobby.js";
import { syncTurnTimer } from "./turnTimer.js";

// One timer per disconnected player: when it fires, their seat is freed.
const graceTimers = new Map(); // "roomId:playerId" -> timeout

export function clearGraceTimer(roomId, playerId) {
  const key = `${roomId}:${playerId}`;
  clearTimeout(graceTimers.get(key));
  graceTimers.delete(key);
}

export function startGraceTimer(io, roomId, playerId) {
  clearGraceTimer(roomId, playerId);
  const timer = setTimeout(() => {
    graceTimers.delete(`${roomId}:${playerId}`);
    const room = getRoom(roomId);
    const name = room?.players[getRoleOf(room, playerId)]?.name;
    if (room && leaveRoom(room, playerId)) {
      console.log(`room ${roomId}: ${playerId.slice(0, 6)} timed out`);
      syncTurnTimer(io, room);
      io.to(roomId).emit("game:state", getPublicState(room));
      if (getRoom(roomId)) announce(io, room, `${name} left.`);
      if (room.visibility === "public") scheduleLobbyUpdate(io);
    }
  }, RECONNECT_GRACE_MS);
  graceTimers.set(`${roomId}:${playerId}`, timer);
}

// Take this socket out of the room it is in (if any) and tell the other player.
export function leaveCurrentRoom(io, socket) {
  const { roomId, playerId } = socket.data;
  if (!roomId) return;

  const room = getRoom(roomId);
  const name = room?.players[getRoleOf(room, playerId)]?.name;
  socket.leave(roomId);
  socket.data.roomId = null;
  socket.data.playerId = null;
  clearGraceTimer(roomId, playerId);

  if (room && leaveRoom(room, playerId)) {
    console.log(`room ${roomId}: ${playerId.slice(0, 6)} left`);
    // If the room was deleted, nobody is listening and this goes nowhere.
    syncTurnTimer(io, room); // also stops the clock of a room that no longer exists
    io.to(roomId).emit("game:state", getPublicState(room));
    if (getRoom(roomId)) announce(io, room, `${name} left.`); // (not if the room is gone)
    if (room.visibility === "public") scheduleLobbyUpdate(io);
  }
}
