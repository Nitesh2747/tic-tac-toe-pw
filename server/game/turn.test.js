import { describe, it, expect } from "vitest";
import {
  TURN_SECONDS_OPTIONS,
  autoMove,
  createRoom,
  getPublicState,
  joinRoom,
  makeMove,
  markDisconnected,
  removeRoom,
  turnTimerShouldRun,
} from "./room.js";

// Two players seated and online: X is "p1" and moves first.
function game(turnSeconds = 15) {
  const room = createRoom({ turnSeconds });
  joinRoom(room, "p1", "s1");
  joinRoom(room, "p2", "s2");
  return room;
}
const play = (room, moves) => moves.forEach(([id, i]) => expect(makeMove(room, id, i).ok).toBe(true));

describe("the turn timer setting", () => {
  it("offers off, 15 and 30 seconds", () => {
    expect(TURN_SECONDS_OPTIONS).toEqual([0, 15, 30]);
  });

  it("a room has no timer by default", () => {
    expect(createRoom().turnSeconds).toBe(0);
    expect(getPublicState(createRoom()).turnSeconds).toBe(0);
  });

  it("keeps a valid length, and falls back to off for anything else", () => {
    expect(createRoom({ turnSeconds: 15 }).turnSeconds).toBe(15);
    expect(createRoom({ turnSeconds: 30 }).turnSeconds).toBe(30);
    for (const bad of [1, 20, -5, "15", null, NaN]) expect(createRoom({ turnSeconds: bad }).turnSeconds).toBe(0);
  });

  it("is public (everyone should see the rules of the room), and the remaining time is null until a clock runs", () => {
    const state = getPublicState(game(30));
    expect(state.turnSeconds).toBe(30);
    expect(state.turnMsLeft).toBeNull();
    expect(state.turnMs).toBeNull();
  });

  it("reports the REMAINING time, not a clock time, while a clock runs", () => {
    const room = game(15);
    room.turnMs = 15_000;
    room.turnDeadline = Date.now() + 9_000;
    const state = getPublicState(room);
    expect(state.turnMsLeft).toBeGreaterThan(8_000);
    expect(state.turnMsLeft).toBeLessThanOrEqual(9_000);
    expect(state.turnMs).toBe(15_000);
    expect(JSON.stringify(state)).not.toContain(String(room.turnDeadline));
  });

  it("never reports negative time", () => {
    const room = game(15);
    room.turnMs = 15_000;
    room.turnDeadline = Date.now() - 5_000;
    expect(getPublicState(room).turnMsLeft).toBe(0);
  });
});

describe("turnTimerShouldRun", () => {
  it("runs only with a timer, two seated and online players, and a game in progress", () => {
    expect(turnTimerShouldRun(game(15))).toBe(true);
  });

  it("does not run when the room has no timer", () => {
    expect(turnTimerShouldRun(game(0))).toBe(false);
  });

  it("does not run while waiting for an opponent", () => {
    const room = createRoom({ turnSeconds: 15 });
    joinRoom(room, "p1", "s1");
    expect(turnTimerShouldRun(room)).toBe(false);
  });

  it("stops while either player is disconnected, and resumes when they return", () => {
    const room = game(15);
    markDisconnected(room, "p2", "s2");
    expect(turnTimerShouldRun(room)).toBe(false);
    joinRoom(room, "p2", "s2-new");
    expect(turnTimerShouldRun(room)).toBe(true);
    markDisconnected(room, "p1", "s1");
    expect(turnTimerShouldRun(room)).toBe(false);
  });

  it("stops when the game is over", () => {
    const room = game(15);
    play(room, [["p1", 0], ["p2", 3], ["p1", 1], ["p2", 4], ["p1", 2]]);
    expect(turnTimerShouldRun(room)).toBe(false);
  });
});

describe("autoMove (what happens when time runs out)", () => {
  it("plays a legal move for whoever's turn it is, then passes the turn", () => {
    const room = game();
    const result = autoMove(room);
    expect(result.ok).toBe(true);
    expect(result.seat).toBe("X");
    expect(room.board[result.index]).toBe("X");
    expect(room.xIsNext).toBe(false);
    expect(autoMove(room).seat).toBe("O");
  });

  it("only ever plays an empty cell, even late in a game", () => {
    for (let trial = 0; trial < 300; trial++) {
      const room = game();
      play(room, [["p1", 0], ["p2", 1], ["p1", 3], ["p2", 4]]);
      const before = [...room.board];
      const result = autoMove(room);
      expect(before[result.index]).toBeNull();
      expect(room.board.filter(Boolean)).toHaveLength(5);
      removeRoom(room);
    }
  });

  it("can play any empty cell (it really is random)", () => {
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const room = game();
      seen.add(autoMove(room).index);
      removeRoom(room);
    }
    expect(seen.size).toBe(9);
  });

  it("counts the result if its move ends the game, exactly once", () => {
    const room = game();
    play(room, [["p1", 0], ["p2", 3], ["p1", 1], ["p2", 4]]); // X to move, 2 wins it
    // keep timing out until the game ends
    let guard = 0;
    while (autoMove(room).ok && guard++ < 9);
    const total = room.scores.X + room.scores.O + room.scores.draws;
    expect(total).toBe(1);
  });

  it("does nothing once the game is over", () => {
    const room = game();
    play(room, [["p1", 0], ["p2", 3], ["p1", 1], ["p2", 4], ["p1", 2]]);
    const board = [...room.board];
    expect(autoMove(room)).toEqual({ ok: false });
    expect(room.board).toEqual(board);
    expect(room.scores.X).toBe(1);
  });

  it("does nothing while an opponent is missing", () => {
    const room = createRoom({ turnSeconds: 15 });
    joinRoom(room, "p1", "s1");
    expect(autoMove(room)).toEqual({ ok: false });
    expect(room.board.every((c) => c === null)).toBe(true);
  });
});
