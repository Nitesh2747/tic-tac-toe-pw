import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { CHAT_MAX, formatTime } from "../game/chat.js";
import { keyboardInset } from "../game/viewport.js";
import { useVisualViewport } from "../hooks/useVisualViewport.js";

// The messages and the box to write one. `onSend(text)` resolves to { ok, error? }.
// With `onClose` it is the small-screen sheet; without, the panel beside the board.
export default function ChatPanel({ messages, role, canSend, placeholder, onSend, onClose }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true); // false once the reader scrolls up to older messages

  // The phone keyboard hides the bottom of the page, so the sheet lifts itself above it
  // and never grows taller than the part of the screen that is left.
  const visible = useVisualViewport();
  const sheetStyle =
    onClose && visible
      ? { "--kb": `${keyboardInset(window.innerHeight, visible)}px`, "--vvh": `${visible.height}px` }
      : undefined;

  // A new message scrolls into view, unless you scrolled up to read; your own always does.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const mine = messages.at(-1)?.seat === role;
    if (stickToBottom.current || mine) {
      list.scrollTop = list.scrollHeight;
      stickToBottom.current = true;
    }
  }, [messages, role]);

  // When the chat gets taller or shorter (the keyboard opening, a rotation), stay on the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(() => {
      if (stickToBottom.current) list.scrollTop = list.scrollHeight;
    });
    watcher.observe(list);
    return () => watcher.disconnect();
  }, []);

  // The small-screen sheet opens ready to type.
  useEffect(() => {
    if (onClose) inputRef.current?.focus();
  }, [onClose]);

  function handleScroll() {
    const list = listRef.current;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending || !canSend) return;
    setSending(true);
    const result = await onSend(value);
    setSending(false);
    if (result.ok) {
      setText("");
      setError("");
    } else {
      setError(result.error);
    }
    inputRef.current?.focus();
  }

  const length = [...text].length;

  return (
    <section
      className={`chat ${onClose ? "chat--sheet" : ""}`}
      aria-label="Chat"
      style={sheetStyle}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onClose) onClose();
      }}
    >
      <header className="chat__header">
        <h2 className="chat__title">Chat</h2>
        {onClose && (
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      <ol className="chat__list" ref={listRef} onScroll={handleScroll} role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <li className="chat__empty">No messages yet. Say hello!</li>}
        {messages.map((m) => {
          if (m.system) {
            return (
              <li key={m.id} className="chat__item chat__item--system">
                <span className="chat__system">{m.text}</span>
              </li>
            );
          }
          const mine = m.seat === role;
          return (
            <li key={m.id} className={`chat__item ${mine ? "chat__item--mine" : "chat__item--theirs"}`}>
              {!mine && <Avatar seed={m.avatarSeed} size={22} />}
              <div className="chat__bubble">
                <div className="chat__meta">
                  <span className="chat__name">{mine ? "You" : m.name}</span>
                  <time className="chat__time" dateTime={new Date(m.at).toISOString()}>
                    {formatTime(m.at)}
                  </time>
                </div>
                <p className="chat__text">{m.text}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <form className="chat__form" onSubmit={handleSubmit}>
        <label htmlFor="chat-message" className="visually-hidden">
          Message
        </label>
        <input
          id="chat-message"
          ref={inputRef}
          className="chat__input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          maxLength={CHAT_MAX}
          placeholder={canSend ? "Message…" : placeholder}
          disabled={!canSend}
          name="chat-message"
          autoComplete="off"
          enterKeyHint="send"
          data-lpignore="true"
          data-1p-ignore="true"
        />
        <button type="submit" className="reset reset--highlight chat__send" disabled={!canSend || sending || !text.trim()}>
          Send
        </button>
      </form>
      <p className={`chat__info ${error ? "chat__error" : ""}`} role={error ? "alert" : undefined}>
        {error || (length >= 150 ? `${length}/${CHAT_MAX}` : "")}
      </p>
    </section>
  );
}
