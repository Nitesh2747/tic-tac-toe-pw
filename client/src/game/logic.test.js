import { describe, it, expect } from "vitest";
import {
  EMPTY_BOARD,
  WINNING_LINES,
  calculateWinner,
  getGameStatus,
  applyMove,
} from "./logic.js";

const board = (str) =>
  str
    .replace(/\s/g, "")
    .split("")
    .map((c) => (c === "-" ? null : c));

describe("calculateWinner", () => {
  it("returns null for an empty board", () => {
    expect(calculateWinner(EMPTY_BOARD)).toBeNull();
  });

  it("detects every winning line for both players", () => {
    for (const player of ["X", "O"]) {
      for (const line of WINNING_LINES) {
        const b = Array(9).fill(null);
        line.forEach((i) => (b[i] = player));
        expect(calculateWinner(b)).toEqual({ winner: player, line });
      }
    }
  });

  it("does not report a winner for mixed lines", () => {
    expect(calculateWinner(board("XOX OXO OXO"))).toBeNull();
  });
});

describe("getGameStatus", () => {
  it("detects a draw", () => {
    const s = getGameStatus(board("XOX XOO OXX"), true);
    expect(s.winner).toBeNull();
    expect(s.isDraw).toBe(true);
    expect(s.gameOver).toBe(true);
  });

  it("is not a draw if the last move wins", () => {
    const s = getGameStatus(board("XXX OOX OXO"), false);
    expect(s.winner).toBe("X");
    expect(s.isDraw).toBe(false);
  });

  it("reports whose turn it is", () => {
    expect(getGameStatus(EMPTY_BOARD, true).nextPlayer).toBe("X");
    expect(getGameStatus(EMPTY_BOARD, false).nextPlayer).toBe("O");
  });
});

describe("applyMove", () => {
  it("ignores anything that is not a real cell number", () => {
    const b = board("--- --- ---");
    for (const bad of ["1", "0", 1.5, -1, 9, 99, NaN, null, undefined, {}, [1]]) {
      expect(applyMove(b, bad, "X")).toBe(b);
    }
  });

  it("places a mark without mutating the old board", () => {
    const next = applyMove(EMPTY_BOARD, 4, "X");
    expect(next[4]).toBe("X");
    expect(EMPTY_BOARD[4]).toBeNull();
  });

  it("ignores moves on taken cells", () => {
    const b = board("X-- --- ---");
    expect(applyMove(b, 0, "O")).toBe(b);
  });

  it("ignores moves after the game is won", () => {
    const b = board("XXX OO- ---");
    expect(applyMove(b, 8, "O")).toBe(b);
  });
});
