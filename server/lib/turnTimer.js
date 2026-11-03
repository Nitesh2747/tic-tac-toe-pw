// The turn timer. Each room with a timer has at most one running: when it fires,
// a random legal move is played for whoever's turn it is.
import { autoMove, getPublicState, getRoom, turnTimerShouldRun } from "../game/room.js";
import { announceResult } from "./chat.js";
import { TURN_SECOND_MS } from "../config.js";

const timers = new Map(); // roomId -> { timeout, key }

// Identifies "this exact turn": the same board with the same player to move.
const turnKey = (room) => `${room.board.map((cell) => cell ?? "-").join("")}|${room.xIsNext}`;

export function clearTurnTimer(room) {
  const running = timers.get(room.id);
  if (running) clearTimeout(running.timeout);
  timers.delete(room.id);
  room.turnDeadline = null;
  room.turnMs = null;
}

// Call this after ANYTHING that could change whether the clock should run or whose
// turn it is: a move, a player sitting down, leaving, dropping or coming back, a
// new round. It is safe to call as often as you like: it only (re)starts the
// clock when the turn is actually different from the one already being timed.
export function syncTurnTimer(io, room) {
  if (!turnTimerShouldRun(room)) {
    clearTurnTimer(room);
    return;
  }

  const key = turnKey(room);
  if (timers.get(room.id)?.key === key) return; // already timing this very turn

  clearTurnTimer(room);
  const ms = room.turnSeconds * TURN_SECOND_MS;
  room.turnMs = ms;
  room.turnDeadline = Date.now() + ms;
  timers.set(room.id, { timeout: setTimeout(() => onTimeUp(io, room.id, key), ms), key });
}

function onTimeUp(io, roomId, key) {
  timers.delete(roomId);
  const room = getRoom(roomId);
  // Make sure nothing changed while we waited (every change re-syncs, but be certain).
  if (!room || turnKey(room) !== key || !turnTimerShouldRun(room)) return;

  const result = autoMove(room);
  if (!result.ok) return;

  console.log(`room ${room.id}: time ran out, random move ${result.index} for ${result.seat}`);
  io.to(room.id).emit("game:timeout", { seat: result.seat, index: result.index });
  syncTurnTimer(io, room); // the next turn's clock (or none, if that move ended the game)
  io.to(room.id).emit("game:state", getPublicState(room));
  announceResult(io, room); // a random move can end the round too
}
