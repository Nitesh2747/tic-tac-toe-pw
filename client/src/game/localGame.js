// The state of an offline game (two players on one device, or you against the
// computer): the board, whose turn it is, and the running score.
// Pure functions: each takes the current state and returns the next one.
import { EMPTY_BOARD, applyMove, getGameStatus } from "./logic.js";

export function newLocalGame() {
  return {
    board: [...EMPTY_BOARD],
    xIsNext: true,
    starter: "X", // who moves first this round; alternates every round
    scores: { X: 0, O: 0, draws: 0 },
  };
}

// Play a cell. Illegal moves (taken cell, game over, bad index) return the same
// state. A move that ends the game adds to the score, exactly once.
export function playLocalMove(game, index) {
  const { gameOver, nextPlayer } = getGameStatus(game.board, game.xIsNext);
  if (gameOver) return game;

  const board = applyMove(game.board, index, nextPlayer);
  if (board === game.board) return game;

  const xIsNext = !game.xIsNext;
  const after = getGameStatus(board, xIsNext);
  const scores = { ...game.scores };
  if (after.winner) scores[after.winner] += 1;
  else if (after.isDraw) scores.draws += 1;

  return { ...game, board, xIsNext, scores };
}

// A fresh board. After a finished round the other player starts; restarting a
// round that is still in progress keeps the same starter. The score stays.
export function nextLocalRound(game) {
  const finished = getGameStatus(game.board, game.xIsNext).gameOver;
  const starter = finished ? (game.starter === "X" ? "O" : "X") : game.starter;
  return { ...game, board: [...EMPTY_BOARD], starter, xIsNext: starter === "X" };
}
