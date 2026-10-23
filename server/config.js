// Reads settings from the environment. dotenv must load before anything reads
// process.env, so every module gets its settings from here, never directly.
import "dotenv/config";

export const PORT = process.env.PORT || 3001;

// Comma-separated list, e.g. "https://my-app.vercel.app,http://localhost:5173"
export const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// How long a disconnected player keeps their seat before it is freed.
export const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 60_000;

// Only public rooms are listed in the lobby. Updates are batched so a burst of
// changes sends one list, not one per change.
export const LOBBY_THROTTLE_MS = Number(process.env.LOBBY_THROTTLE_MS) || 300;

// Wrong private-room codes: how many a connection / an IP address may try per window.
export const CODE_FAIL_WINDOW_MS = Number(process.env.CODE_FAIL_WINDOW_MS) || 60_000;
export const CODE_FAILS_PER_SOCKET = Number(process.env.CODE_FAILS_PER_SOCKET) || 5;
export const CODE_FAILS_PER_IP = Number(process.env.CODE_FAILS_PER_IP) || 30;

// Set TRUST_PROXY=true only when the server runs behind a proxy you control
// (Render, nginx...). Then the client's address comes from X-Forwarded-For.
// Otherwise that header is client-controlled and must be ignored.
export const TRUST_PROXY = process.env.TRUST_PROXY === "true";

