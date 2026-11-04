// The game rules (logic.js) live in three places: /client, /server and /bot. They must stay identical, so these tests fail if one copy is edited on its own.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyMove, calculateWinner, getComputerMove } from "./logic.js";

// Reads a file by its path relative to this one.
function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("logic.js copies", () => {
  const botCopy = read("./logic.js");

  it("is identical to the server's copy", () => {
    expect(botCopy).toBe(read("../../server/game/logic.js"));
  });

  it("is identical to the client's copy", () => {
    expect(botCopy).toBe(read("../../client/src/game/logic.js"));
  });
});

describe("logic.js inside the bot", () => {
  it("can be used: the computer takes a win, and the win is detected", () => {
    let board = Array(9).fill(null);
    // X has squares 0 and 1, O has 3 and 4, and it is X's turn.
    for (const [index, player] of [[0, "X"], [3, "O"], [1, "X"], [4, "O"]]) {
      board = applyMove(board, index, player);
    }

    const move = getComputerMove(board, "X", "medium");
    board = applyMove(board, move, "X");

    expect(move).toBe(2);
    expect(calculateWinner(board)).toEqual({ winner: "X", line: [0, 1, 2] });
  });
});