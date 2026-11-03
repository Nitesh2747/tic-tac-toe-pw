import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { clearTurnTimer, syncTurnTimer } from "./turnTimer.js";
import { createRoom, getPublicState, joinRoom, leaveRoom, makeMove, markDisconnected, removeRoom } from "../game/room.js";

// A pretend Socket.IO server that just records what it is told to send.
function fakeIo() {
  const sent = [];
  return { sent, to: (room) => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) };
}
const events = (io, name) => io.sent.filter((e) => e.event === name);

let io, room;
beforeEach(() => {
  vi.useFakeTimers();
  io = fakeIo();
  room = createRoom({ turnSeconds: 15 });
  joinRoom(room, "p1", "s1");
  joinRoom(room, "p2", "s2");
});
afterEach(() => {
  clearTurnTimer(room);
  removeRoom(room);
  vi.useRealTimers();
});

// A move made the way the real handlers do it: validate, then sync.
function move(playerId, index) {
  expect(makeMove(room, playerId, index).ok).toBe(true);
  syncTurnTimer(io, room);
}

describe("starting", () => {
  it("starts a clock when both players are seated and online", () => {
    syncTurnTimer(io, room);
    expect(vi.getTimerCount()).toBe(1);
    expect(room.turnMs).toBe(15_000);
    expect(getPublicState(room).turnMsLeft).toBeGreaterThan(14_900);
  });

  it("never starts one for a room without a timer", () => {
    const untimed = createRoom({ turnSeconds: 0 });
    joinRoom(untimed, "a", "sa"); joinRoom(untimed, "b", "sb");
    syncTurnTimer(io, untimed);
    expect(vi.getTimerCount()).toBe(0);
    expect(untimed.turnDeadline).toBeNull();
    removeRoom(untimed);
  });

  it("does not start while waiting for an opponent", () => {
    const lonely = createRoom({ turnSeconds: 15 });
    joinRoom(lonely, "a", "sa");
    syncTurnTimer(io, lonely);
    expect(vi.getTimerCount()).toBe(0);
    removeRoom(lonely);
  });

  it("is safe to call over and over: it does not restart a clock that is already running", () => {
    syncTurnTimer(io, room);
    const deadline = room.turnDeadline;
    vi.advanceTimersByTime(5_000);
    for (let i = 0; i < 10; i++) syncTurnTimer(io, room);
    expect(room.turnDeadline).toBe(deadline);
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe("running out of time", () => {
  it("fires after exactly the set time, not before", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(14_999);
    expect(events(io, "game:timeout")).toHaveLength(0);
    expect(room.board.every((c) => c === null)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(events(io, "game:timeout")).toHaveLength(1);
  });

  it("plays a random legal move for the player whose turn it was, and tells the room", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(15_000);
    const [timeout] = events(io, "game:timeout");
    expect(timeout.payload.seat).toBe("X");
    expect(room.board[timeout.payload.index]).toBe("X");
    expect(room.xIsNext).toBe(false);
    expect(timeout.room).toBe(room.id);
  });

  it("announces the move BEFORE the new state, and the new state already carries the next clock", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(15_000);
    const order = io.sent.map((e) => e.event);
    expect(order.indexOf("game:timeout")).toBeLessThan(order.indexOf("game:state"));
    const state = events(io, "game:state")[0].payload;
    expect(state.turnMsLeft).toBeGreaterThan(14_900); // O's fresh 15 seconds
    expect(state.board.filter(Boolean)).toHaveLength(1);
  });

  it("keeps going: the next player gets a clock, and times out too", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(15_000);
    const seats = events(io, "game:timeout").map((e) => e.payload.seat);
    expect(seats).toEqual(["X", "O"]);
    expect(room.board.filter(Boolean)).toHaveLength(2);
  });

  it("plays a whole game by itself if nobody ever moves, then stops and counts one result", () => {
    syncTurnTimer(io, room);
    for (let i = 0; i < 12; i++) vi.advanceTimersByTime(15_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(room.turnDeadline).toBeNull();
    expect(room.scores.X + room.scores.O + room.scores.draws).toBe(1);
    const lastMoves = events(io, "game:timeout").length;
    vi.advanceTimersByTime(120_000);
    expect(events(io, "game:timeout")).toHaveLength(lastMoves); // nothing more once it is over
  });
});

describe("a move resets the clock", () => {
  it("the original deadline passes quietly after a manual move", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(10_000);
    move("p1", 4); // X plays with 5 seconds to spare: O now has a fresh 15
    vi.advanceTimersByTime(10_000); // 20s since the start: X's old deadline (15s) is long gone
    expect(events(io, "game:timeout")).toHaveLength(0);
    vi.advanceTimersByTime(5_000); // 25s: O's fresh clock finishes
    expect(events(io, "game:timeout")).toHaveLength(1);
    expect(events(io, "game:timeout")[0].payload.seat).toBe("O");
  });

  it("the new clock is a full turn long", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(14_000);
    move("p1", 0);
    expect(getPublicState(room).turnMsLeft).toBeGreaterThan(14_900);
  });
});

describe("pausing", () => {
  it("a player dropping stops the clock, and nothing is played for them", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(8_000);
    markDisconnected(room, "p2", "s2");
    syncTurnTimer(io, room);
    expect(vi.getTimerCount()).toBe(0);
    expect(getPublicState(room).turnMsLeft).toBeNull();
    vi.advanceTimersByTime(120_000);
    expect(events(io, "game:timeout")).toHaveLength(0);
    expect(room.board.every((c) => c === null)).toBe(true);
  });

  it("when they come back, the player to move gets a FULL fresh turn", () => {
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(12_000);
    markDisconnected(room, "p2", "s2"); syncTurnTimer(io, room);
    vi.advanceTimersByTime(30_000);
    joinRoom(room, "p2", "s2-new"); syncTurnTimer(io, room);
    expect(getPublicState(room).turnMsLeft).toBeGreaterThan(14_900);
    vi.advanceTimersByTime(14_999);
    expect(events(io, "game:timeout")).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events(io, "game:timeout")).toHaveLength(1);
  });

  it("the player who is NOT to move dropping pauses it too", () => {
    syncTurnTimer(io, room); // X to move
    markDisconnected(room, "p1", "s1"); // ...and X is the one who dropped
    syncTurnTimer(io, room);
    vi.advanceTimersByTime(60_000);
    expect(events(io, "game:timeout")).toHaveLength(0);
  });
});

describe("stopping for good", () => {
  it("stops when the game is won", () => {
    syncTurnTimer(io, room);
    for (const [id, i] of [["p1", 0], ["p2", 3], ["p1", 1], ["p2", 4], ["p1", 2]]) move(id, i);
    expect(vi.getTimerCount()).toBe(0);
    expect(getPublicState(room).turnMsLeft).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(events(io, "game:timeout")).toHaveLength(0);
  });

  it("stops when a player leaves", () => {
    syncTurnTimer(io, room);
    leaveRoom(room, "p2");
    syncTurnTimer(io, room);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(events(io, "game:timeout")).toHaveLength(0);
  });

  it("does not blow up if the room is deleted while a clock is running", () => {
    syncTurnTimer(io, room);
    leaveRoom(room, "p1");
    leaveRoom(room, "p2"); // the room is gone
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();
    expect(events(io, "game:timeout")).toHaveLength(0);
  });

  it("a stale clock does nothing if the board changed without a re-sync (belt and braces)", () => {
    syncTurnTimer(io, room);
    expect(makeMove(room, "p1", 4).ok).toBe(true); // changed WITHOUT syncTurnTimer
    vi.advanceTimersByTime(15_000);
    expect(events(io, "game:timeout")).toHaveLength(0);
    expect(room.board.filter(Boolean)).toHaveLength(1);
  });

  it("a new round starts a new clock", () => {
    syncTurnTimer(io, room);
    for (const [id, i] of [["p1", 0], ["p2", 3], ["p1", 1], ["p2", 4], ["p1", 2]]) move(id, i);
    expect(vi.getTimerCount()).toBe(0);
    // "Play again": the board is cleared and the other player starts
    room.board = room.board.map(() => null); room.starter = "O"; room.xIsNext = false;
    syncTurnTimer(io, room);
    expect(vi.getTimerCount()).toBe(1);
    expect(getPublicState(room).turnMsLeft).toBeGreaterThan(14_900);
  });
});
