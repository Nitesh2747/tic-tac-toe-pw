// Reads settings from the environment. dotenv must load before anything reads process.env, so every module gets its settings from here, never directly.
import "dotenv/config";

export const PORT = process.env.PORT || 3001;

export const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// How long a disconnected player keeps their seat before it is freed.
export const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 60_000;

// Only public rooms are listed in the lobby. Updates are batched so a burst of changes sends one list, not one per change.
export const LOBBY_THROTTLE_MS = Number(process.env.LOBBY_THROTTLE_MS) || 300;

// Wrong private-room codes: how many a connection / an IP address may try per window.
export const CODE_FAIL_WINDOW_MS = Number(process.env.CODE_FAIL_WINDOW_MS) || 60_000;
export const CODE_FAILS_PER_SOCKET = Number(process.env.CODE_FAILS_PER_SOCKET) || 5;
export const CODE_FAILS_PER_IP = Number(process.env.CODE_FAILS_PER_IP) || 30;

// Set TRUST_PROXY=true only when the server runs behind a proxy you control (Render, nginx...). Then the client's address comes from X-Forwarded-For. Otherwise that header is client-controlled and must be ignored.
export const TRUST_PROXY = process.env.TRUST_PROXY === "true";

// How long one "second" of the turn timer lasts, in milliseconds. Always 1000 in real life: it exists so tests can run a 15-second timer in under a second.
export const TURN_SECOND_MS = Number(process.env.TURN_SECOND_MS) || 1000;

// Chat: at most this many messages per player in any window.
export const CHAT_MAX_MESSAGES = Number(process.env.CHAT_MAX_MESSAGES) || 5;
export const CHAT_WINDOW_MS = Number(process.env.CHAT_WINDOW_MS) || 5000;

// ---------- abuse limits ----------
// How many connections one IP address may hold open at the same time. (A school or an office can share one address, so this is generous.)
export const MAX_CONNECTIONS_PER_IP = Number(process.env.MAX_CONNECTIONS_PER_IP) || 20;

// How many events (create, join, move, chat...) one connection may send per window. Past that, requests are refused, and a connection that keeps flooding is dropped.
export const EVENT_LIMIT = Number(process.env.EVENT_LIMIT) || 40;
export const EVENT_WINDOW_MS = Number(process.env.EVENT_WINDOW_MS) || 5000;

// How many rooms one IP address may create per window.
export const ROOM_CREATES_PER_IP = Number(process.env.ROOM_CREATES_PER_IP) || 10;
export const ROOM_CREATE_WINDOW_MS = Number(process.env.ROOM_CREATE_WINDOW_MS) || 60_000;