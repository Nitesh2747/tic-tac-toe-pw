import { randomInt } from "node:crypto";
import { EMPTY_BOARD, applyMove, getGameStatus } from "./logic.js";

// All rooms live in memory.
const rooms = new Map(); // roomId -> room
const roomsByCode = new Map(); // code -> roomId (private rooms only)

// No 0/O/1/I so codes are easy to read out loud.
export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_ID_LENGTH = 10;
export const CODE_LENGTH = 6; // 32^6 is about a billion combinations

// crypto.randomInt, not Math.random: a code is a secret, and Math.random is
// predictable enough that it must never be used for one.
function randomString(length) {
  let text = "";
  for (let i = 0; i < length; i++) text += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return text;
}

function uniqueRoomId() {
  let id;
  do id = randomString(ROOM_ID_LENGTH);
  while (rooms.has(id));
  return id;
}

function uniqueCode() {
  let code;
  do code = randomString(CODE_LENGTH);
  while (roomsByCode.has(code));
  return code;
}

// People type and paste codes: ignore case, spaces and dashes.
export function normalizeCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Rooms live in memory, so cap them: nobody can fill the server's RAM by
// spamming "create room".
const MAX_ROOMS = 1000;
// The lobby list is capped too, so one update can never get huge.
const MAX_LISTED_ROOMS = 100;

function newScores() {
  return { X: 0, O: 0, draws: 0 };
}

// A fresh, empty board. The starter of the round moves first.
function startFreshBoard(room) {
  room.board = [...EMPTY_BOARD];
  room.xIsNext = room.starter === "X";
}

// A room has a name and a display ("public" or "private"). Public rooms are
// listed in the lobby and joined by clicking. Private rooms are never listed;
// they are joined with their secret code (or a link that contains it).
// Returns the new room, or null if the server is full.
export function createRoom({ name = "Room", visibility = "public" } = {}) {
  if (rooms.size >= MAX_ROOMS) return null;
  const isPrivate = visibility === "private";
  const room = {
    id: uniqueRoomId(),
    name,
    visibility: isPrivate ? "private" : "public",
    code: isPrivate ? uniqueCode() : null, // secret: never in public state or the lobby list
    hostId: null, // the first player to sit down; the host can remove players
    bannedIds: new Set(), // players the host removed
    createdAt: Date.now(),
    board: [...EMPTY_BOARD],
    xIsNext: true,
    starter: "X", // who moves first this round; alternates every round
    scores: newScores(), // wins per seat, plus draws, for the current pair of players
    scoreOwners: { X: null, O: null }, // who last sat in each seat: the score belongs to them
    players: { X: null, O: null }, // each seat: { playerId, socketId, connected, name, avatarSeed } or null
  };
  rooms.set(room.id, room);
  if (room.code) roomsByCode.set(room.code, room.id);
  return room;
}

// Forget a room (and its code). Exported so tests can clean up after themselves.
export function removeRoom(room) {
  rooms.delete(room.id);
  if (room.code) roomsByCode.delete(room.code);
}

export function getRoom(id) {
  return rooms.get(id);
}

export function findRoomByCode(raw) {
  const id = roomsByCode.get(normalizeCode(raw));
  return id ? rooms.get(id) : undefined;
}

// Works out which room a join request is for.
// Returns { room } or { error }.
//   - a code finds a private room;
//   - an id finds a public room, or a room the player already sits in (that is
//     how a refresh rejoins). A private room can NOT be entered by id alone.
export function findJoinTarget({ roomId, code }, playerId) {
  if (code !== undefined && code !== null && code !== "") {
    const room = findRoomByCode(code);
    return room ? { room } : { error: "No room found for that code" };
  }
  if (typeof roomId === "string" && roomId !== "") {
    const room = rooms.get(roomId.trim().toUpperCase());
    const allowed = room && (room.visibility === "public" || getRoleOf(room, playerId) !== null);
    return allowed ? { room } : { error: "Room not found" };
  }
  return { error: "Missing room" };
}

export function isBanned(room, playerId) {
  return room.bannedIds.has(playerId);
}

// Handlers always pass a validated profile. The default only lets tests and
// scripts seat players without inventing one every time.
const DEFAULT_PROFILE = { name: "Player", avatarSeed: "anonymous0" };

// Returns "X", "O", or null if the room is full.
export function joinRoom(room, playerId, socketId, profile = DEFAULT_PROFILE) {
  // Same player coming back? Give them their old seat.
  for (const role of ["X", "O"]) {
    if (room.players[role]?.playerId === playerId) {
      room.players[role].socketId = socketId;
      room.players[role].connected = true;
      // They may have changed their name or avatar since last time.
      room.players[role].name = profile.name;
      room.players[role].avatarSeed = profile.avatarSeed;
      return role;
    }
  }
  // Otherwise take the first free seat (first player is X).
  for (const role of ["X", "O"]) {
    if (!room.players[role]) {
      // The score belongs to the pair of players who earned it. The same person
      // coming back keeps it; a different person taking the seat starts fresh.
      const previousOwner = room.scoreOwners[role];
      if (previousOwner !== null && previousOwner !== playerId) {
        room.scores = newScores();
        room.starter = "X";
        startFreshBoard(room);
      }
      room.scoreOwners[role] = playerId;
      if (room.hostId === null) room.hostId = playerId;

      room.players[role] = {
        playerId,
        socketId,
        connected: true,
        name: profile.name,
        avatarSeed: profile.avatarSeed,
      };
      return role;
    }
  }
  return null;
}

// What other players may see about a seat: who is sitting there and whether
// they are online. Never the playerId or the socket id.
function publicSeat(seat) {
  if (!seat) return null;
  return { connected: seat.connected, name: seat.name, avatarSeed: seat.avatarSeed };
}

// What we are willing to send to clients (never socket ids or player ids).
export function getPublicState(room) {
  return {
    roomId: room.id,
    name: room.name,
    visibility: room.visibility,
    hostSeat: getRoleOf(room, room.hostId), // "X", "O" or null. Never the host's id.
    board: room.board,
    xIsNext: room.xIsNext,
    status: room.players.X && room.players.O ? "playing" : "waiting",
    scores: { ...room.scores },
    players: { X: publicSeat(room.players.X), O: publicSeat(room.players.O) },
  };
}

// Which seat ("X" / "O") does this player sit in? null if none.
export function getRoleOf(room, playerId) {
  for (const role of ["X", "O"]) {
    if (room.players[role]?.playerId === playerId) return role;
  }
  return null;
}

// Called right after a move. If that move ended the game, count it. Moves are
// refused once a game is over, so each game is counted exactly once.
function recordResult(room) {
  const { winner, isDraw } = getGameStatus(room.board, room.xIsNext);
  if (winner) room.scores[winner] += 1;
  else if (isDraw) room.scores.draws += 1;
}

// Validates and applies a move. Returns { ok: true } or { ok: false, error }.
export function makeMove(room, playerId, index) {
  const role = getRoleOf(room, playerId);
  if (!role) return { ok: false, error: "You are not in this room" };
  if (!room.players.X || !room.players.O) {
    return { ok: false, error: "Waiting for an opponent" };
  }
  if (!room.players.X.connected || !room.players.O.connected) {
    return { ok: false, error: "Opponent disconnected" };
  }

  const { gameOver, nextPlayer } = getGameStatus(room.board, room.xIsNext);
  if (gameOver) return { ok: false, error: "The game is over" };
  if (role !== nextPlayer) return { ok: false, error: "Not your turn" };
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { ok: false, error: "Invalid square" };
  }

  const nextBoard = applyMove(room.board, index, role);
  if (nextBoard === room.board) return { ok: false, error: "Square already taken" };

  room.board = nextBoard;
  room.xIsNext = !room.xIsNext;
  recordResult(room);
  return { ok: true };
}

// Start a new game in the same room. Only allowed once the current game is over.
export function resetGame(room, playerId) {
  if (!getRoleOf(room, playerId)) return { ok: false, error: "You are not in this room" };
  if (!getGameStatus(room.board, room.xIsNext).gameOver) {
    return { ok: false, error: "The game is still in progress" };
  }
  // The other player goes first this time, so nobody always has the advantage.
  room.starter = room.starter === "X" ? "O" : "X";
  startFreshBoard(room);
  return { ok: true };
}

// Free the player's seat. The board restarts for whoever is left, but the score
// is kept: if the same player comes back it carries on, and joinRoom clears it
// only when a different person takes the seat. The room is deleted once both
// seats are empty. Returns true if they were seated.
export function leaveRoom(room, playerId) {
  const role = getRoleOf(room, playerId);
  if (!role) return false;

  // A finished round moves on to the next starter; an abandoned one is replayed.
  if (getGameStatus(room.board, room.xIsNext).gameOver) {
    room.starter = room.starter === "X" ? "O" : "X";
  }

  room.players[role] = null;
  startFreshBoard(room);

  // If the host left, the other player takes over. With nobody left, the room is gone.
  const remaining = room.players.X ?? room.players.O;
  if (room.hostId === playerId) room.hostId = remaining ? remaining.playerId : null;
  if (!remaining) removeRoom(room);
  return true;
}

// The connection behind this seat dropped. The player keeps the seat so they
// can come back. Returns false if they had already reconnected on a newer
// socket (the old socket's "disconnect" can arrive late, e.g. after a refresh).
export function markDisconnected(room, playerId, socketId) {
  const role = getRoleOf(room, playerId);
  if (!role) return false;

  const seat = room.players[role];
  if (seat.socketId !== socketId) return false;

  seat.connected = false;
  return true;
}

// Replace a private room's code with a fresh one. The old code stops working at
// once. Returns the new code, or null for a public room.
export function rotateCode(room) {
  if (room.visibility !== "private") return null;
  roomsByCode.delete(room.code);
  room.code = uniqueCode();
  roomsByCode.set(room.code, room.id);
  return room.code;
}

// The host removes the player in a seat. They are banned from this room, and in
// a private room the code is replaced, so knowing the old code is not enough to
// come back. Returns { ok: true, kicked: { playerId, socketId } } or { ok: false, error }.
export function kickPlayer(room, requesterId, seat) {
  if (room.hostId === null || room.hostId !== requesterId) {
    return { ok: false, error: "Only the host can remove players" };
  }
  if (seat !== "X" && seat !== "O") return { ok: false, error: "Invalid player" };

  const target = room.players[seat];
  if (!target) return { ok: false, error: "Nobody is sitting there" };
  if (target.playerId === requesterId) return { ok: false, error: "You cannot remove yourself" };

  const kicked = { playerId: target.playerId, socketId: target.socketId };
  room.bannedIds.add(kicked.playerId);
  leaveRoom(room, kicked.playerId);
  rotateCode(room);
  return { ok: true, kicked };
}

// What the lobby shows: PUBLIC rooms with someone online, joinable ones first, then newest first.
// Just enough to pick a room: never a code, a player id or a socket id.
export function listPublicRooms() {
  const entries = [];
  for (const room of rooms.values()) {
    if (room.visibility !== "public") continue;
    const players = (room.players.X ? 1 : 0) + (room.players.O ? 1 : 0);
    if (players === 0) continue;
    // A room whose players have all dropped is only waiting out the reconnect
    // grace period. Do not invite people into an empty room: it reappears the
    // moment someone reconnects.
    if (!room.players.X?.connected && !room.players.O?.connected) continue;
    entries.push({ room, players });
  }
  entries.sort(
    (a, b) => (a.players >= 2) - (b.players >= 2) || b.room.createdAt - a.room.createdAt
  );
  return entries.slice(0, MAX_LISTED_ROOMS).map(({ room, players }) => ({
    id: room.id,
    name: room.name,
    display: "public",
    players,
    full: players >= 2,
  }));
}

