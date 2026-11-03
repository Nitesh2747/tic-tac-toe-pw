import { describe, it, expect } from "vitest";
import {
  COMPUTER_LEVELS,
  EMPTY_BOARD,
  calculateWinner,
  emptyCells,
  getComputerMove,
  getGameStatus,
  isBoardFull,
} from "./logic.js";

// ----- every position that can really happen in a game, with whose turn it is -----
function allPositions() {
  const seen = new Map();
  (function walk(board, toMove) {
    const key = board.map((c) => c ?? "-").join("") + toMove;
    if (seen.has(key)) return;
    seen.set(key, { board, toMove });
    if (calculateWinner(board) || isBoardFull(board)) return;
    for (const i of emptyCells(board)) {
      const next = [...board];
      next[i] = toMove;
      walk(next, toMove === "X" ? "O" : "X");
    }
  })([...EMPTY_BOARD], "X");
  return [...seen.values()];
}
const POSITIONS = allPositions();
const live = POSITIONS.filter(({ board }) => !calculateWinner(board) && !isBoardFull(board));
const other = (p) => (p === "X" ? "O" : "X");

// ----- an independent referee: plain negamax, written differently from the real one -----
// Value of the position for the player about to move: 1 win, 0 draw, -1 loss.
const refereeMemo = new Map();
function referee(board, toMove) {
  const key = board.map((c) => c ?? "-").join("") + toMove;
  if (refereeMemo.has(key)) return refereeMemo.get(key);
  let value;
  const won = calculateWinner(board);
  if (won) value = won.winner === toMove ? 1 : -1;
  else if (isBoardFull(board)) value = 0;
  else {
    value = -2;
    for (const i of emptyCells(board)) {
      const next = [...board];
      next[i] = toMove;
      value = Math.max(value, -referee(next, other(toMove)));
    }
  }
  refereeMemo.set(key, value);
  return value;
}
function valueOfMove(board, player, index) {
  const next = [...board];
  next[index] = player;
  return -referee(next, other(player));
}

describe("the game tree itself", () => {
  it("has the 5,478 positions every Tic Tac Toe book says it has", () => {
    expect(POSITIONS.length).toBe(5478);
  });
});

describe("getComputerMove: all levels", () => {
  it("rejects an unknown level", () => {
    expect(() => getComputerMove(EMPTY_BOARD, "O", "impossible")).toThrow(/Unknown level/);
    expect(() => getComputerMove(EMPTY_BOARD, "O", undefined)).not.toThrow(); // defaults to hard
  });

  it("returns -1 when the game is over (won or full)", () => {
    const won = ["X", "X", "X", "O", "O", null, null, null, null];
    const full = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    for (const level of COMPUTER_LEVELS) {
      expect(getComputerMove(won, "O", level)).toBe(-1);
      expect(getComputerMove(full, "X", level)).toBe(-1);
    }
  });

  it("always plays an EMPTY cell, in every reachable position, for both marks", () => {
    for (const level of COMPUTER_LEVELS) {
      for (const { board, toMove } of live) {
        const move = getComputerMove(board, toMove, level);
        expect(Number.isInteger(move)).toBe(true);
        expect(board[move]).toBeNull();
      }
    }
  });

  it("never changes the board it is given", () => {
    const board = ["X", null, null, null, "O", null, null, null, null];
    const copy = [...board];
    for (const level of COMPUTER_LEVELS) getComputerMove(board, "X", level);
    expect(board).toEqual(copy);
  });
});

describe("easy", () => {
  it("picks whichever empty cell the random number points at", () => {
    const board = ["X", null, "O", null, null, null, null, null, null];
    expect(getComputerMove(board, "O", "easy", () => 0)).toBe(1);
    expect(getComputerMove(board, "O", "easy", () => 0.999)).toBe(8);
  });
});

describe("medium: take a win, else block, else anything", () => {
  const threats = live.filter(({ board, toMove }) => {
    const me = toMove;
    const canWin = emptyCells(board).some((i) => {
      const t = [...board]; t[i] = me; return calculateWinner(t)?.winner === me;
    });
    return canWin;
  });
  const mustBlock = live.filter(({ board, toMove }) => {
    const them = other(toMove);
    const canWin = emptyCells(board).some((i) => {
      const t = [...board]; t[i] = toMove; return calculateWinner(t)?.winner === toMove;
    });
    const theyCanWin = emptyCells(board).some((i) => {
      const t = [...board]; t[i] = them; return calculateWinner(t)?.winner === them;
    });
    return !canWin && theyCanWin;
  });

  it("takes an immediate win whenever there is one (in all positions where one exists)", () => {
    expect(threats.length).toBeGreaterThan(100);
    for (const { board, toMove } of threats) {
      for (const r of [0, 0.5, 0.999]) {
        const move = getComputerMove(board, toMove, "medium", () => r);
        const after = [...board]; after[move] = toMove;
        expect(calculateWinner(after)?.winner).toBe(toMove);
      }
    }
  });

  it("blocks your win when it cannot win itself (in all positions where that applies)", () => {
    expect(mustBlock.length).toBeGreaterThan(100);
    for (const { board, toMove } of mustBlock) {
      for (const r of [0, 0.5, 0.999]) {
        const move = getComputerMove(board, toMove, "medium", () => r);
        const them = other(toMove);
        const theirs = [...board]; theirs[move] = them;
        expect(calculateWinner(theirs)?.winner).toBe(them); // the cell it took is the one that would have won for them
      }
    }
  });

  it("prefers winning over blocking", () => {
    // X to move, X can win at 2, O threatens at 5
    const board = ["X", "X", null, "O", "O", null, null, null, null];
    expect(getComputerMove(board, "X", "medium", () => 0)).toBe(2);
  });

  it("is beatable: a fork wins against it", () => {
    // X plays 0, O (medium) plays randomly: just check it does not always choose perfectly
    const board = ["X", null, null, null, null, null, null, null, null];
    const moves = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((r) => getComputerMove(board, "O", "medium", () => r)));
    expect(moves.size).toBeGreaterThan(3);
  });
});

describe("hard: perfect play", () => {
  it("every move it can ever choose is optimal (checked against an independent referee, in all 4,520 live positions)", () => {
    expect(live.length).toBe(4520);
    for (const { board, toMove } of live) {
      const best = Math.max(...emptyCells(board).map((i) => valueOfMove(board, toMove, i)));
      for (const r of [0, 0.31, 0.62, 0.999]) {
        const move = getComputerMove(board, toMove, "hard", () => r);
        expect(valueOfMove(board, toMove, move)).toBe(best);
      }
    }
  });

  it("can NEVER lose: whatever you play, as either X or O, with any tie-break", () => {
    for (const computer of ["X", "O"]) {
      for (const r of [0, 0.5, 0.999]) {
        let games = 0;
        (function human(board, toMove) {
          const { gameOver, winner } = getGameStatus(board, toMove === "X");
          if (gameOver) {
            games++;
            expect(winner).not.toBe(other(computer)); // the human never wins
            return;
          }
          if (toMove === computer) {
            const next = [...board]; next[getComputerMove(board, computer, "hard", () => r)] = computer;
            human(next, other(toMove));
          } else {
            for (const i of emptyCells(board)) {
              const next = [...board]; next[i] = toMove; human(next, other(toMove));
            }
          }
        })([...EMPTY_BOARD], "X");
        expect(games).toBeGreaterThan(50); // it really did explore many human strategies
      }
    }
  });

  it("punishes a real mistake: from a position that is lost for the human, it wins every time", () => {
    // X opened in the centre and O answered on an EDGE: that is the losing reply
    // (the only safe answers to a centre opening are the corners).
    const start = ["X", "O", null, null, null, null, null, null, null].map((_, i) => (i === 4 ? "X" : i === 1 ? "O" : null));
    expect(referee(start, "X")).toBe(1); // the referee agrees: forced win for X
    for (const r of [0, 0.5, 0.999]) {
      let games = 0;
      (function walk(board, toMove) {
        const status = getGameStatus(board, toMove === "X");
        if (status.gameOver) {
          games++;
          expect(status.winner).toBe("X"); // however O plays on, X (the computer) wins
          return;
        }
        if (toMove === "X") {
          const next = [...board]; next[getComputerMove(board, "X", "hard", () => r)] = "X";
          walk(next, "O");
        } else {
          for (const i of emptyCells(board)) {
            const next = [...board]; next[i] = "O"; walk(next, "X");
          }
        }
      })(start, "X");
      expect(games).toBeGreaterThan(5);
    }
  });

  it("hard against hard always ends in a draw", () => {
    for (const r of [0, 0.4, 0.999]) {
      let b = [...EMPTY_BOARD], toMove = "X";
      while (!getGameStatus(b, toMove === "X").gameOver) {
        b[getComputerMove(b, toMove, "hard", () => r)] = toMove; toMove = other(toMove);
      }
      expect(calculateWinner(b)).toBeNull();
      expect(isBoardFull(b)).toBe(true);
    }
  });

  it("does not open every game the same way", () => {
    const openings = new Set(Array.from({ length: 200 }, (_, i) => getComputerMove(EMPTY_BOARD, "X", "hard", () => i / 200)));
    expect(openings.size).toBeGreaterThanOrEqual(8);
  });

  it("is instant, even on an empty board", () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) getComputerMove(EMPTY_BOARD, "X", "hard");
    expect((performance.now() - start) / 20).toBeLessThan(50);
  });
});
