// Pure game logic: no React in here.
// The board is a flat array of 9 cells. Each cell is null, "X" or "O".
// Index layout:
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8

export const EMPTY_BOARD = Array(9).fill(null);

// The 8 ways to win, as indexes into the board.
export const WINNING_LINES = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // columns
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6],
];

// Returns { winner: "X" | "O", line: [a, b, c] } or null if nobody has won.
export function calculateWinner(board) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

export function isBoardFull(board) {
  return board.every((cell) => cell !== null);
}

// Everything the UI needs to know, derived from the board alone.
export function getGameStatus(board, xIsNext) {
  const result = calculateWinner(board);
  const winner = result ? result.winner : null;
  const line = result ? result.line : [];
  const isDraw = !winner && isBoardFull(board);
  const gameOver = Boolean(winner) || isDraw;
  const nextPlayer = xIsNext ? "X" : "O";
  return { winner, line, isDraw, gameOver, nextPlayer };
}

// Returns a NEW board with the move applied, or the same board if the move is illegal.
export function applyMove(board, index, player) {
  // Only a real cell number counts: board["1"] would read cell 1, and board[99] is undefined.
  if (!Number.isInteger(index) || index < 0 || index > 8) return board;
  if (board[index] !== null) return board;
  if (calculateWinner(board)) return board;
  const next = [...board];
  next[index] = player;
  return next;
}

// ---------- the computer opponent ----------
// Pure functions again, so the server and the Discord bot can use them too.

export const COMPUTER_LEVELS = ["easy", "medium", "hard"];

export function emptyCells(board) {
  const cells = [];
  board.forEach((cell, index) => {
    if (cell === null) cells.push(index);
  });
  return cells;
}

const otherPlayer = (player) => (player === "X" ? "O" : "X");

// A cell where `player` would complete a line right now, or -1.
function findWinningCell(board, player) {
  for (const index of emptyCells(board)) {
    const test = [...board];
    test[index] = player;
    if (calculateWinner(test)?.winner === player) return index;
  }
  return -1;
}

function pickOne(list, random) {
  return list[Math.floor(random() * list.length)];
}

// Minimax: how good is this position for `me`, if both sides play perfectly?
// +10 means "I win", -10 "I lose", 0 a draw. Subtracting the depth makes a quick
// win worth more than a slow one and a slow loss better than a quick one.
// Tic Tac Toe is tiny (under 6,000 positions), so remembering what we already
// worked out (memo) makes this instant.
function minimaxScore(board, toMove, me, depth, memo) {
  const result = calculateWinner(board);
  if (result) return result.winner === me ? 10 - depth : depth - 10;
  const options = emptyCells(board);
  if (options.length === 0) return 0;

  const key = board.map((cell) => cell ?? "-").join("") + toMove;
  if (memo.has(key)) return memo.get(key);

  const scores = options.map((index) => {
    const next = [...board];
    next[index] = toMove;
    return minimaxScore(next, otherPlayer(toMove), me, depth + 1, memo);
  });
  const score = toMove === me ? Math.max(...scores) : Math.min(...scores);
  memo.set(key, score);
  return score;
}

// Which cell should `player` (the computer) play? Returns an index 0-8, or -1 if
// the game is already over.
//   easy:   any empty cell.
//   medium: win if it can, otherwise block your win, otherwise any empty cell.
//   hard:   perfect play (minimax). It can never lose. Moves that are equally
//           good are chosen at random, so it does not play the same game every time.
// `random` is only a parameter so tests can control the choices.
export function getComputerMove(board, player, level = "hard", random = Math.random) {
  if (!COMPUTER_LEVELS.includes(level)) throw new Error(`Unknown level: ${level}`);
  const options = emptyCells(board);
  if (options.length === 0 || calculateWinner(board)) return -1;

  if (level === "easy") return pickOne(options, random);

  if (level === "medium") {
    const win = findWinningCell(board, player);
    if (win !== -1) return win;
    const block = findWinningCell(board, otherPlayer(player));
    if (block !== -1) return block;
    return pickOne(options, random);
  }

  const memo = new Map();
  const scored = options.map((index) => {
    const next = [...board];
    next[index] = player;
    return { index, score: minimaxScore(next, otherPlayer(player), player, 1, memo) };
  });
  const best = Math.max(...scored.map((entry) => entry.score));
  return pickOne(
    scored.filter((entry) => entry.score === best).map((entry) => entry.index),
    random
  );
}

