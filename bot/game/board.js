// Turns a game into "what to show": a text message and three rows of button
// descriptions. Still no Discord code in here. render.js turns these descriptions
// into real Discord buttons.
import { COMPUTER, currentSeat, getResult } from "./game.js";

// Every button's id starts with this, then the square number: "ttt:move:0" ... "ttt:move:8".
// When someone clicks, the id tells the bot which square it was.
export const MOVE_PREFIX = "ttt:move:";

// Discord insists that a button has a label, so an empty square gets an invisible character.
const EMPTY_LABEL = "​";

// How a seat is shown in text: a mention for a person, a description for the computer.
function nameOf(game, seat) {
  const id = game.players[seat];
  return id === COMPUTER ? `the computer (${game.level})` : `<@${id}>`;
}

function describeSquare(game, index, result) {
  const customId = `${MOVE_PREFIX}${index}`;
  const mark = game.board[index];

  if (mark === null) {
    // A free square: grey, and clickable while the round is still going.
    return { customId, label: EMPTY_LABEL, style: "secondary", disabled: result.over };
  }
  // A taken square: red X, blue O, and green when it is part of the winning line.
  const style = result.line.includes(index) ? "success" : mark === "X" ? "danger" : "primary";
  return { customId, label: mark, style, disabled: true };
}

function describeStatus(game, result) {
  const lines = [`**X** ${nameOf(game, "X")}  vs  **O** ${nameOf(game, "O")}`];

  if (result.winner) {
    lines.push(`🎉 ${nameOf(game, result.winner)} wins!`);
  } else if (result.isDraw) {
    lines.push("It's a draw.");
  } else {
    const seat = currentSeat(game);
    lines.push(`${nameOf(game, seat)}'s turn (${seat})`);
  }

  const { X, O, draws } = game.scores;
  if (X + O + draws > 0) lines.push(`Score: X ${X} · O ${O} · draws ${draws}`);
  return lines.join("\n");
}

// { content: "the text above the board", rows: [[3 buttons], [3 buttons], [3 buttons]] }
// Each button is { customId, label, style, disabled }, with style one of
// "primary" | "secondary" | "success" | "danger".
export function describeBoard(game) {
  const result = getResult(game);
  const squares = game.board.map((_, index) => describeSquare(game, index, result));
  return {
    content: describeStatus(game, result),
    rows: [squares.slice(0, 3), squares.slice(3, 6), squares.slice(6, 9)],
  };
}
