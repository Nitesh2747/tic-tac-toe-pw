import Square from "./Square.jsx";
import { getWinLine, BOARD_SIZE } from "../game/winLine.js";

export default function Board({ board, onSquareClick, winningLine, gameOver }) {
  const winLine = getWinLine(winningLine);
  const winner = winLine ? board[winningLine[0]] : null;

  return (
    <div className="board" role="group" aria-label="Game board">
      {board.map((value, i) => {
        const row = Math.floor(i / 3) + 1;
        const col = (i % 3) + 1;
        return (
          <Square
            key={i}
            value={value}
            onClick={() => onSquareClick(i)}
            disabled={gameOver || value !== null}
            isWinning={winningLine.includes(i)}
            label={`Row ${row}, column ${col}, ${value ?? "empty"}`}
          />
        );
      })}

      {winLine && (
        // key: a new win remounts the SVG, so the draw-in animation plays again.
        <svg
          key={winningLine.join("-")}
          className={`board__line board__line--${winner.toLowerCase()}`}
          viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
          aria-hidden="true"
        >
          <line
            x1={winLine.x1}
            y1={winLine.y1}
            x2={winLine.x2}
            y2={winLine.y2}
            style={{ "--len": winLine.length }}
          />
        </svg>
      )}
    </div>
  );
}
