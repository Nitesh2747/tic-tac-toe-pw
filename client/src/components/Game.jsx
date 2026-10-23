import { useState } from "react";
import Board from "./Board.jsx";
import Status from "./Status.jsx";
import { EMPTY_BOARD, applyMove, getGameStatus } from "../game/logic.js";

export default function Game() {
  // The ONLY two pieces of state. Everything else is derived below.
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [xIsNext, setXIsNext] = useState(true);

  const { winner, line, isDraw, gameOver, nextPlayer } = getGameStatus(
    board,
    xIsNext
  );

  function handleSquareClick(index) {
    const nextBoard = applyMove(board, index, nextPlayer);
    if (nextBoard === board) return; // illegal move: nothing changes
    setBoard(nextBoard);
    setXIsNext(!xIsNext);
  }

  function handleReset() {
    setBoard(EMPTY_BOARD);
    setXIsNext(true);
  }

  return (
    <section className="game">
      <Status winner={winner} isDraw={isDraw} nextPlayer={nextPlayer} />
      <Board
        board={board}
        onSquareClick={handleSquareClick}
        winningLine={line}
        gameOver={gameOver}
      />
      <button
        type="button"
        className={`reset ${gameOver ? "reset--highlight" : ""}`}
        onClick={handleReset}
      >
        {gameOver ? "Play again" : "Reset game"}
      </button>
    </section>
  );
}
