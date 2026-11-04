// The rules of ONE Discord game, with no Discord code in it: who is playing, whose turn it is, and what a click does. Discord only shows what comes out of here.
// A "game" is a plain object. Every function below returns a NEW game and never changes the one you give it.
import {
  COMPUTER_LEVELS,
  applyMove,
  getComputerMove,
  getGameStatus,
} from "./logic.js";

// The computer's "user id"
export const COMPUTER = "computer";

const fail = (error) => ({ ok: false, error });

// ---------- looking at a game ----------

// "X" or "O" for the seat that is playing, or null if the user isn't in this game.
export function seatOf(game, userId) {
  if (game.players.X === userId) return "X";
  if (game.players.O === userId) return "O";
  return null;
}

// What the screen needs to know about how the round stands.
export function getResult(game) {
  if (game.resignedBy) {
    return {
      over: true,
      winner: game.resignedBy === "X" ? "O" : "X",
      line: [],
      isDraw: false,
      resignedBy: game.resignedBy,
    };
  }
  const status = getGameStatus(game.board, game.xIsNext);
  return {
    over: status.gameOver,
    winner: status.winner,
    line: status.line,
    isDraw: status.isDraw,
    resignedBy: null,
  };
}

// Whose turn it is: "X", "O", or null once the round is over.
export function currentSeat(game) {
  if (getResult(game).over) return null;
  return game.xIsNext ? "X" : "O";
}

function computerSeat(game) {
  if (game.players.X === COMPUTER) return "X";
  if (game.players.O === COMPUTER) return "O";
  return null;
}

export function isComputerTurn(game) {
  const seat = currentSeat(game);
  return seat !== null && seat === computerSeat(game);
}

// ---------- starting ----------

// A new game. x moves first unless xStarts is false.
//   level: "easy" | "medium" | "hard", needed when one player is COMPUTER.
export function createGame({ x, o, level = null, xStarts = true, random = Math.random }) {
  if (x === o) throw new Error("A game needs two different players");
  if ((x === COMPUTER || o === COMPUTER) && !COMPUTER_LEVELS.includes(level)) {
    throw new Error(`A game against the computer needs a level, got: ${level}`);
  }
  return startRound(
    { players: { X: x, O: o }, level, scores: { X: 0, O: 0, draws: 0 } },
    xStarts,
    random,
  );
}

// A fresh board. If the computer is the one to start, it plays its first move here.
function startRound({ players, level, scores }, xStarts, random) {
  const game = {
    players,
    level,
    scores,
    board: Array(9).fill(null),
    starter: xStarts ? "X" : "O",
    xIsNext: xStarts,
    resignedBy: null,
    lastMove: null,
  };
  return isComputerTurn(game) ? playComputerTurn(game, random).game : game;
}

// "Play again": the other player starts, the seats and the score stay.
export function rematch(game, random = Math.random) {
  if (!getResult(game).over) return fail("The game isn't finished yet.");
  const xStarts = game.starter === "O";
  const { players, level, scores } = game;
  return { ok: true, game: startRound({ players, level, scores }, xStarts, random) };
}

// ---------- playing ----------

// After a move: if it ended the round, add it to the score.
function recordResult(game) {
  const result = getResult(game);
  if (!result.over) return game;
  const scores = { ...game.scores };
  if (result.winner) scores[result.winner] += 1;
  else scores.draws += 1;
  return { ...game, scores };
}

function place(game, seat, index) {
  return recordResult({
    ...game,
    board: applyMove(game.board, index, seat),
    xIsNext: seat === "O", // after O moves it is X's turn, and the other way round
    lastMove: index,
  });
}

function playComputerTurn(game, random) {
  const seat = currentSeat(game);
  const index = getComputerMove(game.board, seat, game.level, random);
  return { game: place(game, seat, index), computerMove: index };
}

//   Returns { ok: true, game, computerMove } (computerMove is a square, or null) or { ok: false, error } with a message that is safe to show the person.
export function playMove(game, userId, index, random = Math.random) {
  if (getResult(game).over) return fail("This game is over.");
  const seat = seatOf(game, userId);
  if (!seat) return fail("You're not playing in this game.");
  if (seat !== currentSeat(game)) return fail("It's not your turn.");
  if (!Number.isInteger(index) || index < 0 || index > 8) return fail("That square doesn't exist.");
  if (game.board[index] !== null) return fail("That square is taken.");

  let next = place(game, seat, index);
  let computerMove = null;
  if (isComputerTurn(next)) {
    ({ game: next, computerMove } = playComputerTurn(next, random));
  }
  return { ok: true, game: next, computerMove };
}

// Giving up: the other player wins the round.
export function resign(game, userId) {
  if (getResult(game).over) return fail("This game is over.");
  const seat = seatOf(game, userId);
  if (!seat) return fail("You're not playing in this game.");
  const winner = seat === "X" ? "O" : "X";
  const scores = { ...game.scores, [winner]: game.scores[winner] + 1 };
  return { ok: true, game: { ...game, resignedBy: seat, scores } };
}