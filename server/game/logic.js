// Pure game logic: no React in here.
// Later, the Express/Socket.IO server (and the Discord bot) can reuse this file.
//
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
  if (board[index] !== null) return board;
  if (calculateWinner(board)) return board;
  const next = [...board];
  next[index] = player;
  return next;
}
