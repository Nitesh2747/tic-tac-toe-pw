import { useEffect, useState } from "react";
import Board from "./Board.jsx";
import Scoreboard from "./Scoreboard.jsx";
import { getComputerMove, getGameStatus } from "../game/logic.js";
import { newLocalGame, playLocalMove, nextLocalRound } from "../game/localGame.js";

const THINK_MS = 500; // the computer pauses a moment so you can see what happened
const LEVEL_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

// An offline game: two players on this device (mode "two"), or you (X) against
// the computer (O) at a given level. Nothing here touches the network.
export default function Game({ mode = "two", level = "medium", profile = null }) {
  const [game, setGame] = useState(newLocalGame);
  const { board, xIsNext, scores } = game;
  const { winner, line, isDraw, gameOver, nextPlayer } = getGameStatus(board, xIsNext);

  const vsComputer = mode === "computer";
  const humanTurn = !vsComputer || nextPlayer === "X"; // the computer is always O

  // When it is the computer's turn, wait a moment, then let it play.
  useEffect(() => {
    if (!vsComputer || gameOver || nextPlayer !== "O") return;
    const timer = setTimeout(() => {
      setGame((current) => {
        const move = getComputerMove(current.board, "O", level);
        return move === -1 ? current : playLocalMove(current, move);
      });
    }, THINK_MS);
    return () => clearTimeout(timer);
  }, [vsComputer, level, gameOver, nextPlayer, board]);

  function handleSquareClick(index) {
    if (!humanTurn) return;
    setGame((current) => playLocalMove(current, index));
  }

  const players = vsComputer
    ? {
        X: { name: profile?.name ?? "You", avatarSeed: profile?.avatarSeed ?? "youyouyou1", connected: true },
        O: { name: "Computer", avatarSeed: "computer0001", connected: true },
      }
    : {
        X: { name: "Player X", avatarSeed: "playerx0001", connected: true },
        O: { name: "Player O", avatarSeed: "playero0001", connected: true },
      };

  let statusText;
  if (vsComputer) {
    if (winner) statusText = winner === "X" ? "You win!" : "Computer wins.";
    else if (isDraw) statusText = "It's a draw.";
    else statusText = humanTurn ? "Your turn" : "Computer is thinking…";
  } else if (winner) statusText = `${winner} wins!`;
  else if (isDraw) statusText = "It's a draw.";
  else statusText = `${nextPlayer}'s turn`;

  const hasScore = scores.X + scores.O + scores.draws > 0;

  return (
    <section className="game">
      <p className="room-info">
        <strong>{vsComputer ? "vs Computer" : "Same device"}</strong>
        {vsComputer && <span className="badge badge--level">{LEVEL_LABELS[level]}</span>}
      </p>

      <Scoreboard scores={scores} players={players} youAre={vsComputer ? "X" : null} />

      <p className={`status ${gameOver ? "status--won" : ""}`} role="status" aria-live="polite">
        {statusText}
      </p>

      <Board
        board={board}
        onSquareClick={handleSquareClick}
        winningLine={line}
        gameOver={gameOver || !humanTurn}
      />

      <div className="actions">
        <button
          type="button"
          className={`reset ${gameOver ? "reset--highlight" : ""}`}
          onClick={() => setGame(nextLocalRound)}
        >
          {gameOver ? "Play again" : "Restart round"}
        </button>
        {hasScore && (
          <button type="button" className="reset" onClick={() => setGame(newLocalGame())}>
            Reset score
          </button>
        )}
      </div>
    </section>
  );
}
