# Server

Express + Socket.IO back end for Tic Tac Toe Online. See the [main README](../README.md) for the event protocol and design decisions.

    cp .env.example .env
    npm install
    npm run dev            # http://localhost:3001, restarts on save
    npm test               # 194 tests: rooms, timer, chat, limits
    npm start              # production

## How the code is organised

| Path | What it does |
| --- | --- |
| `index.js` | Starts the HTTP server and Socket.IO, sets up CORS, serves `GET /health`, registers the handlers and shuts down cleanly on `SIGTERM`. |
| `config.js` | Every setting, read from the environment in one place (loads `.env` with dotenv). Nothing else reads `process.env`. |
| `game/logic.js` | The rules and the computer opponent. A copy of `client/src/game/logic.js`: keep the two identical. |
| `game/room.js` | Rooms, in memory: seats, scores, host, bans, private codes, the public state sent to browsers and the lobby list. |
| `handlers/` | One file per group of socket events. `roomHandlers.js` (create, join, leave, kick, disconnect), `gameHandlers.js` (move, reset), `lobbyHandlers.js`, `chatHandlers.js`. |
| `lib/membership.js` | Leaving a room, and the reconnect grace period for dropped players. |
| `lib/turnTimer.js` | The turn timer: starts, restarts, pauses and plays the random move on timeout. |
| `lib/chat.js` | Cleaning chat text, storing the last messages, server lines such as "Maya joined.". |
| `lib/lobby.js` | Batches lobby updates so a burst of changes sends one list. |
| `lib/rateLimit.js` | A sliding-window limiter, used for wrong private-room codes and for chat. |
| `lib/profile.js`, `lib/validate.js` | Checking what browsers send: names, room names, avatar seeds, the timer setting, IDs. |
| `lib/clientIp.js` | Finding a client's address, with `TRUST_PROXY` support. |

**The rule that shapes everything:** the server decides. Browsers send requests, `handlers/` validate them and change the room, and the new public state is sent to everyone in it. Anything secret (player IDs, private codes) stays out of the public state, the lobby list and chat.

## Settings

Set these in `.env` (see `.env.example`). The full table, with defaults, is in the [main README](../README.md#configuration).

- **`CLIENT_ORIGIN`**: the exact URL(s) of the client, comma-separated. Required in production.
- **`PORT`**: most hosts set this for you.
- **`TRUST_PROXY=true`**: only when the server is behind a proxy you control (Render, nginx…). Without it, every visitor behind a proxy shares one rate-limit bucket. With it set when there is *no* proxy, clients could fake their address.
- Tuning: `RECONNECT_GRACE_MS`, `LOBBY_THROTTLE_MS`, `CODE_FAIL_WINDOW_MS`, `CODE_FAILS_PER_SOCKET`, `CODE_FAILS_PER_IP`, `CHAT_MAX_MESSAGES`, `CHAT_WINDOW_MS`.
- **`TURN_SECOND_MS`** is for tests only. It shortens the turn timer's "second" so tests do not wait. Never set it in production.

## Limits

| What | Limit |
| --- | --- |
| Rooms alive at once | 1000 |
| Rooms listed in the lobby | 100 (public rooms with a connected player) |
| Wrong private-room codes | 5 per minute per connection, 30 per minute per IP |
| Chat | 200 characters per message, 5 messages per 5 seconds per player, last 50 kept per room |
| Names | 2 to 16 characters (room names 2 to 24) |
| Network message size | 10 KB |
| Seat held after a disconnect | 60 seconds |

## Run it as one instance

Rooms live in this process's memory. A restart clears them, and two copies of the server would each have their own rooms. `GET /health` returns `{ "ok": true }` for health checks.

## Tests

`npm test` runs 10 test files, next to the code they cover:

| Area | Files |
| --- | --- |
| Rooms: seats, scores, host, bans, capacity, visibility | `game/room.test.js`, `game/room.cap.test.js`, `game/rooms.visibility.test.js` |
| Turn timer: the room rules, and the timer itself with fake clocks | `game/turn.test.js`, `lib/turnTimer.test.js` |
| Chat: cleaning, limits, history, who may speak | `lib/chat.test.js` |
| Checking input, lobby list, limits, client address | `lib/profile.test.js`, `lib/lobby.test.js`, `lib/rateLimit.test.js`, `lib/clientIp.test.js` |

The socket events themselves are not covered by automated tests in this repository.
