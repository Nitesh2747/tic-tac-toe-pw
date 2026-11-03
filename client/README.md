# Client

React + Vite front end for Tic Tac Toe Online. See the [main README](../README.md) for what it does, how it works and the event protocol.

    cp .env.example .env   # points at the local server
    npm install
    npm run dev            # http://localhost:5173
    npm test               # 120 tests: rules, computer opponent, helpers
    npm run build          # needs VITE_SERVER_URL

`VITE_SERVER_URL` is baked into the build, so set it to the server's public URL when you deploy. The `dist/` folder is a static site and can be hosted anywhere.

## How the code is organised

| Folder | What is in it |
| --- | --- |
| `src/App.jsx` | Owns the one socket connection, the signed-in profile, the current online *session* (`{ role, state, code, chat }`) and the offline mode. It decides which screen is showing and turns server events into state. |
| `src/components/` | The screens and pieces of UI. |
| `src/game/` | Plain JavaScript with no React: the rules, the computer opponent, offline game state, helpers. Easy to test, and the reason most of the tests are fast. |
| `src/hooks/` | Small hooks that wrap browser features: theme, lobby list, countdown, media queries, the visible part of the screen. |

**Which screen shows**

- `Lobby` when you are not in a room: choose a name, pick a public room, type a private code, create a room, or start an offline game.
- `OnlineGame` when you are in a room (an online *session* exists): board, scoreboard, turn timer, host controls and chat.
- `Game` for the offline modes, `mode="two"` (same device) or `mode="computer"` with a level. `ComputerSetup` is the level picker before it.

**State flow.** The server is the source of truth. `App` keeps the latest `game:state` it was sent and passes it down. Components draw from it and send requests (`game:move`, `chat:send`…) back. The winner and the winning line are not part of the state: they are worked out from the board by `game/logic.js` and `game/winLine.js`, the same rules the server uses.

**`game/logic.js` is a copy** of `server/game/logic.js`. The two files must stay identical, since both the rules and the computer opponent live there.

## Things worth knowing

- **Browser storage.** `ttt-player-id`, `ttt-profile`, `ttt-theme` and `ttt-last-room` in `localStorage`, and `ttt-room-id` in `sessionStorage`. The table in the main README says what each holds. All reads and writes are wrapped in `try/catch`, so a browser that blocks storage still works.
- **Works on plain `http://`.** `navigator.clipboard` and `crypto.randomUUID` do not exist outside secure contexts (for example a phone opening `http://192.168…`). `game/clipboard.js` and `game/playerId.js` have fallbacks.
- **Layout.** Screens are built to fit the window without page scrolling. The board size is calculated from the window with CSS `clamp()`, and the lobby list scrolls inside its own box. Colours are CSS variables on `:root`, with a dark set under `prefers-color-scheme` and a `data-theme` override.
- **Chat placement.** At 980px wide and above the chat sits beside the board. Below that it is a button with an unread badge that opens a bottom sheet. `useVisualViewport` and `game/viewport.js` lift the sheet above the phone keyboard so the message box is never hidden.
- **Accessibility.** Squares have labels ("Row 1, column 2, empty"), the status line and chat are live regions, focus is always visible, and animation is turned off under `prefers-reduced-motion`.

## Tests

`npm test` runs 13 test files next to the code they cover, all in `src/game/`:

| Area | Files |
| --- | --- |
| Rules and computer opponent | `logic.test.js`, `ai.test.js` |
| Offline game | `localGame.test.js` |
| Win line, countdown, keyboard sizing | `winLine.test.js`, `countdown.test.js`, `viewport.test.js` |
| Chat helpers | `chat.test.js` |
| Profile, avatar, invite links | `profile.test.js`, `avatar.test.js`, `invite.test.js` |
| Browser storage and fallbacks | `playerId.test.js`, `savedRoom.test.js`, `clipboard.test.js` |

The screens themselves are not covered by automated tests here.
