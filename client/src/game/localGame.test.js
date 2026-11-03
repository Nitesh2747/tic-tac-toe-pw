import { describe, it, expect } from "vitest";
import { newLocalGame, playLocalMove, nextLocalRound } from "./localGame.js";

// Plays cells in order, alternating X and O.
const play = (game, cells) => cells.reduce((g, i) => playLocalMove(g, i), game);
const X_WINS = [0, 3, 1, 4, 2];
const O_WINS = [0, 3, 1, 4, 8, 5]; // X O X O X O -> O completes 3,4,5
const DRAW = [0, 1, 2, 4, 3, 5, 7, 6, 8];

describe("newLocalGame", () => {
  it("starts empty, X first, score 0-0-0", () => {
    const g = newLocalGame();
    expect(g.board.every((c) => c === null)).toBe(true);
    expect(g.xIsNext).toBe(true);
    expect(g.scores).toEqual({ X: 0, O: 0, draws: 0 });
  });
});

describe("playLocalMove", () => {
  it("places the mark and passes the turn", () => {
    const g = playLocalMove(newLocalGame(), 4);
    expect(g.board[4]).toBe("X");
    expect(g.xIsNext).toBe(false);
    expect(playLocalMove(g, 0).board[0]).toBe("O");
  });

  it("does not change the state it was given", () => {
    const g = newLocalGame();
    playLocalMove(g, 4);
    expect(g.board[4]).toBeNull();
    expect(g.xIsNext).toBe(true);
  });

  it("ignores a taken cell, a bad index and moves after the game is over", () => {
    const g = playLocalMove(newLocalGame(), 4);
    expect(playLocalMove(g, 4)).toBe(g);
    expect(playLocalMove(g, 9)).toBe(g);
    expect(playLocalMove(g, -1)).toBe(g);
    expect(playLocalMove(g, "1")).toBe(g);
    const over = play(newLocalGame(), X_WINS);
    expect(playLocalMove(over, 8)).toBe(over);
  });

  it("counts a win once, for the right side", () => {
    expect(play(newLocalGame(), X_WINS).scores).toEqual({ X: 1, O: 0, draws: 0 });
    expect(play(newLocalGame(), O_WINS).scores).toEqual({ X: 0, O: 1, draws: 0 });
  });

  it("counts a draw", () => {
    expect(play(newLocalGame(), DRAW).scores).toEqual({ X: 0, O: 0, draws: 1 });
  });

  it("does not count anything while the game is still going", () => {
    expect(play(newLocalGame(), [0, 3, 1]).scores).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it("cannot count the same game twice by clicking on after it ended", () => {
    const over = play(newLocalGame(), X_WINS);
    expect(play(over, [8, 7, 6]).scores.X).toBe(1);
  });
});

describe("nextLocalRound", () => {
  it("after a finished round, the OTHER player starts, and the score stays", () => {
    const g = nextLocalRound(play(newLocalGame(), X_WINS));
    expect(g.board.every((c) => c === null)).toBe(true);
    expect(g.starter).toBe("O");
    expect(g.xIsNext).toBe(false);
    expect(g.scores.X).toBe(1);
  });

  it("alternates every round", () => {
    // Whoever moves first wins a round with these five cells (they take 0, 1, 2).
    let g = newLocalGame();
    const starters = [];
    for (let i = 0; i < 4; i++) {
      starters.push(g.starter);
      g = nextLocalRound(play(g, X_WINS));
    }
    expect(starters).toEqual(["X", "O", "X", "O"]);
    expect(g.scores.X + g.scores.O).toBe(4);
  });

  it("restarting a round that is still in progress keeps the same starter", () => {
    const g = nextLocalRound(play(newLocalGame(), [0, 3]));
    expect(g.starter).toBe("X");
    expect(g.xIsNext).toBe(true);
    expect(g.board.every((c) => c === null)).toBe(true);
  });

  it("starting a round while the other player is to move still gives a clean board", () => {
    const g = nextLocalRound(play(newLocalGame(), [4]));
    expect(g.xIsNext).toBe(true);
  });
});
