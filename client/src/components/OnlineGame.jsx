import { useEffect, useRef, useState } from "react";
import Board from "./Board.jsx";
import Scoreboard from "./Scoreboard.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { socket } from "../game/socket.js";
import { getGameStatus } from "../game/logic.js";
import { copyText } from "../game/clipboard.js";
import { buildInviteLink } from "../game/invite.js";
import { URGENT_SECONDS, fractionLeft, secondsLeft } from "../game/countdown.js";
import { countUnread } from "../game/chat.js";
import { useCountdown } from "../hooks/useCountdown.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

export default function OnlineGame({ role, state, code, chat = [], connected, onLeave }) {
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false); // "Copy invite link" feedback
  const [codeCopied, setCodeCopied] = useState(false); // "Copy code" feedback
  const [showCode, setShowCode] = useState(false);
  const [confirmingKick, setConfirmingKick] = useState(false);
  // Set when the turn timer ran out and the server played a random move: { seat }
  const [timeoutNote, setTimeoutNote] = useState(null);

  // An error takes over the status line for a few seconds, then gives it back.
  // (A separate error paragraph would make the page taller than the window.)
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
  // The CSS cuts a long name to a fixed width (with an ellipsis), whatever the
  // alphabet: counting characters would not work, a CJK character is twice as wide.
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

  // The turn timer. The server owns it; we only display the time it says is left.
  const remainingMs = useCountdown(state.turnMsLeft, state);
  const timing = remainingMs !== null && connected && !waiting && !opponentAway && !gameOver;
  const seconds = timing ? secondsLeft(remainingMs) : null;
  const urgent = timing && seconds <= URGENT_SECONDS;

  // The server tells us when it played a random move because time ran out.
  useEffect(() => {
    function onTimeout({ seat }) {
      setTimeoutNote({ seat });
    }
    socket.on("game:timeout", onTimeout);
    return () => socket.off("game:timeout", onTimeout);
  }, []);
  useEffect(() => {
    if (!timeoutNote) return;
    const timer = setTimeout(() => setTimeoutNote(null), 4000);
    return () => clearTimeout(timer);
  }, [timeoutNote]);

  // If the opponent goes away, a half-finished "are you sure?" makes no sense.
  useEffect(() => {
    if (!opponentSeated) setConfirmingKick(false);
  }, [opponentSeated]);

  function handleSquareClick(index) {
    setError("");
    // No optimistic update: the board only changes when the server broadcasts
    // the new state. The ack is only used to show an error if the move was refused.
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

  // The host removes the opponent. The server checks that we really are the host.
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

  // Chat. A wide window shows it beside the board; a narrow one keeps it behind a button.
  const wide = useMediaQuery("(min-width: 980px)");
  const [chatOpen, setChatOpen] = useState(false);
  const [seenId, setSeenId] = useState(() => chat.at(-1)?.id ?? 0); // history you arrive to is not "new"
  const toggleRef = useRef(null);
  const chatVisible = wide || chatOpen;
  const lastId = chat.at(-1)?.id ?? 0;
  useEffect(() => {
    if (chatVisible) setSeenId(lastId); // whatever is on screen counts as read
  }, [chatVisible, lastId]);
  const unread = chatVisible ? 0 : countUnread(chat, seenId, role);
  const canChat = connected && opponentSeated;
  const chatPlaceholder = !connected ? "Reconnecting…" : "Nobody here yet…";

  function sendChat(text) {
    return new Promise((resolve) => socket.emit("chat:send", { text }, resolve));
  }

  function closeChat() {
    setChatOpen(false);
    toggleRef.current?.focus();
  }

  const timeoutText = !timeoutNote ? null : timeoutNote.seat === role ? (
    "Time's up! A random move was played for you."
  ) : (
    <>Time&apos;s up! A random move was played for {opponentName}.</>
  );
  // The countdown stays visible next to the "time's up" message: the next player's
  // own clock is already running while that message is on screen.
  const showTimer = timing && !error;

  return (
    <div className="room">
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
          {state.turnSeconds > 0 && (
            <span className="badge badge--timer" title={`${state.turnSeconds} seconds per turn`}>
              {state.turnSeconds}s
            </span>
          )}
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
          className={[
            "status",
            gameOver && !error ? "status--won" : "",
            error ? "status--error" : "",
            timing ? "status--timed" : "",
            urgent && showTimer ? "status--urgent" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={timing ? { "--pct": `${fractionLeft(remainingMs, state.turnMs) * 100}%` } : undefined}
          role={error ? "alert" : "status"}
          aria-live={error ? "assertive" : "polite"}
        >
          {error || timeoutText || statusText}
          {showTimer && ` · ${seconds}s`}
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

      {wide ? (
        <ChatPanel
          messages={chat}
          role={role}
          canSend={canChat}
          placeholder={chatPlaceholder}
          onSend={sendChat}
        />
      ) : (
        <>
          <button
            ref={toggleRef}
            type="button"
            className="chat-toggle"
            onClick={() => setChatOpen((open) => !open)}
            aria-label={unread > 0 ? `Chat, ${unread} new` : "Chat"}
            aria-expanded={chatOpen}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
            </svg>
            {unread > 0 && (
              <span className="chat-toggle__badge" aria-hidden="true">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {chatOpen && (
            <ChatPanel
              messages={chat}
              role={role}
              canSend={canChat}
              placeholder={chatPlaceholder}
              onSend={sendChat}
              onClose={closeChat}
            />
          )}
        </>
      )}
    </div>
  );
}
