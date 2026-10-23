import { useEffect, useState } from "react";
import Board from "./Board.jsx";
import Scoreboard from "./Scoreboard.jsx";
import { socket } from "../game/socket.js";
import { getGameStatus } from "../game/logic.js";
import { copyText } from "../game/clipboard.js";
import { buildInviteLink } from "../game/invite.js";

export default function OnlineGame({ role, state, code, connected, onLeave }) {
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false); // "Copy invite link" feedback
  const [codeCopied, setCodeCopied] = useState(false); // "Copy code" feedback
  const [showCode, setShowCode] = useState(false);
  const [confirmingKick, setConfirmingKick] = useState(false);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const waiting = state.status === "waiting";
  const { winner, line, isDraw, gameOver } = getGameStatus(
    state.board,
    state.xIsNext
  );
  const myTurn = (state.xIsNext ? "X" : "O") === role;
  const opponent = role === "X" ? "O" : "X";
  const opponentFullName = state.players[opponent]?.name ?? "Opponent";
  const opponentName = (
    <span className="status__name" title={opponentFullName}>
      {opponentFullName}
    </span>
  );
  const opponentSeated = Boolean(state.players[opponent]);
  const opponentAway = opponentSeated && !state.players[opponent].connected;
  const isHost = state.hostSeat === role;
  const isPrivate = state.visibility === "private";
  const canPlay = connected && !waiting && !opponentAway && !gameOver && myTurn;

  useEffect(() => {
    if (!opponentSeated) setConfirmingKick(false);
  }, [opponentSeated]);

  function handleSquareClick(index) {
    setError("");
    socket.emit("game:move", { index }, (res) => {
      if (!res.ok) setError(res.error);
    });
  }

  function handleReset() {
    setError("");
    socket.emit("game:reset", (res) => {
      if (!res.ok) setError(res.error);
    });
  }

  async function handleCopyInvite() {
    const link = buildInviteLink(window.location.origin, {
      visibility: state.visibility,
      roomId: state.roomId,
      code,
    });
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Could not copy the link.");
    }
  }

  async function handleCopyCode() {
    if (await copyText(code)) {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } else {
      setError("Could not copy the code.");
    }
  }


  function handleKick() {
    socket.emit("room:kick", { seat: opponent }, (res) => {
      setConfirmingKick(false);
      if (!res.ok) setError(res.error);
    });
  }

  let statusText;
  if (!connected) statusText = "Connection lost. Reconnecting…";
  else if (waiting) statusText = "Waiting for an opponent…";
  else if (winner) statusText = winner === role ? "You win!" : <>{opponentName} wins.</>;
  else if (isDraw) statusText = "It's a draw.";
  else if (opponentAway) statusText = <>{opponentName} disconnected. Waiting for them…</>;
  else statusText = myTurn ? "Your turn" : <>{opponentName}'s turn</>;

  return (
    <section
      className={[
        "game",
        isPrivate && code ? "game--code" : "",
        isHost && opponentSeated ? "game--crowded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="room-info">
        <strong className="room-info__name" title={state.name}>
          {state.name}
        </strong>
        <span className={`badge badge--${state.visibility}`}>{isPrivate ? "Private" : "Public"}</span>
        <span className="room-info__you">
          You are <strong>{role}</strong>
        </span>
      </p>

      {/* A private room's code is shown only here, to the players sitting in it. */}
      {isPrivate && code && (
        <p className="room-code">
          Code{" "}
          <strong className="room-code__value">{showCode ? code : "••••••"}</strong>
          <button type="button" className="link-button" onClick={() => setShowCode((v) => !v)}>
            {showCode ? "Hide" : "Show"}
          </button>
          <button type="button" className="link-button" onClick={handleCopyCode}>
            {codeCopied ? "Copied!" : "Copy code"}
          </button>
        </p>
      )}

      <Scoreboard scores={state.scores} players={state.players} youAre={role} />

      <p
        className={`status ${gameOver && !error ? "status--won" : ""} ${error ? "status--error" : ""}`}
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
      >
        {error || statusText}
      </p>

      {/* Board's "gameOver" prop really means "disable every square". */}
      <Board
        board={state.board}
        onSquareClick={handleSquareClick}
        winningLine={line}
        gameOver={!canPlay}
      />

      <div className="actions">
        {waiting && (
          <button
            type="button"
            className="reset reset--highlight"
            onClick={handleCopyInvite}
          >
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        )}
        {gameOver && (
          <button
            type="button"
            className="reset reset--highlight"
            onClick={handleReset}
          >
            Play again
          </button>
        )}
        {isHost && opponentSeated && !confirmingKick && (
          <button type="button" className="reset" onClick={() => setConfirmingKick(true)}>
            Kick {opponentName}
          </button>
        )}
        {isHost && opponentSeated && confirmingKick && (
          <>
            <button type="button" className="reset reset--danger" onClick={handleKick}>
              Yes, kick {opponentName}
            </button>
            <button type="button" className="reset" onClick={() => setConfirmingKick(false)}>
              Cancel
            </button>
          </>
        )}
        <button type="button" className="reset" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </section>
  );
}
