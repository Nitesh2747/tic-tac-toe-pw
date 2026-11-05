# Tic Tac Toe Discord bot

Play Tic Tac Toe inside a Discord channel, with buttons. Challenge another member, or play against the computer. It is the Discord version of the [online Tic Tac Toe site](../README.md) in this repo, and it reuses the site's game rules and computer opponent.

## How to play

| Command | What it does |
|---|---|
| `/ttt computer [level]` | Start a game against the computer. `level` is `easy`, `medium` (default) or `hard` (it cannot lose). |
| `/ttt challenge @someone` | Challenge a member. They get **Accept** and **Decline** buttons. |

The board is nine buttons in a channel message. Click a square to play.

- You play **X** (red) and move first. The opponent is **O** (blue). The winning line turns green.
- Only the two players can click, and only on their own turn. Anyone else gets a private message that only they can see.
- **Resign** (under the board) gives the round to your opponent. After a round, **Play again** starts the next one on the same message. The score carries over and the other player starts.
- A challenge can be declined by the challenged player or cancelled by the challenger.
- A board or challenge nobody has touched for **10 minutes** is closed: the buttons are removed and the message says so.

## Setup

You need Node 18 or newer (the project is tested on 22.14.0) and a Discord application with a bot.

1. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application, add a bot, and copy the bot **token**, the application's **Application ID** and the **ID of your test server**.
2. Invite the bot to your server with the `bot` and `applications.commands` scopes. It must be able to see the channels where people play.
3. Copy `.env.example` to `.env` and fill it in.

   ```
   DISCORD_TOKEN=   # the bot token
   CLIENT_ID=       # the application ID
   GUILD_ID=        # the server where the commands are registered
   ```

4. Install, register the slash commands, and start the bot:

   ```bash
   npm install
   npm run deploy   # registers /ttt in your server; run again only when discord/commands.js changes
   npm start        # or: npm run dev   (restarts when a file changes)
   ```

Commands are registered for one server (`GUILD_ID`), so they appear instantly.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Run the bot. |
| `npm run dev` | Run the bot and restart it on every file change. |
| `npm run deploy` | Register the slash commands with Discord. |
| `npm test` | Run the tests. |

## How it is built

The rules are kept apart from Discord, so they can be tested without a Discord connection.

```
bot/
├── index.js              connects to Discord, hands every interaction on, closes idle boards
├── scripts/
│   └── deploy-commands.js    one-off: registers the slash commands
├── discord/              everything that touches Discord
│   ├── commands.js           the /ttt command definition
│   ├── interactions.js       what a command or a click does
│   ├── render.js             turns a game into a Discord message with buttons
│   └── expire.js             closes boards nobody is playing any more
└── game/                 plain JavaScript: no Discord in here
    ├── logic.js              the rules and the computer (a copy of the site's file)
    ├── game.js               a game's state: moves, turns, score, resign, rematch
    ├── board.js              decides what to show: text and button descriptions
    ├── challenge.js          "A challenges B": accept, decline, cancel
    └── store.js              remembers games in progress, forgets idle ones
```

- A game is a plain object. Every action returns a new game, or an error message that is safe to show.
- Each game lives in memory under the id of the message that shows it, so a click can find its game.
- `game/logic.js` is the same file as the server's and the client's. A test fails if the copies drift apart, so a fix made in one place cannot be forgotten in another.

## Tests

```bash
npm test
```

The tests cover the game state, what is shown, the challenge flow, the idle timeout, and the click handling (with fake Discord interactions, so no network is needed). They run in GitHub Actions on every push and pull request, alongside the server and client tests.

## Known limits

- Games live in memory. If the bot restarts, boards in progress stop working ("This game isn't active any more") and players start a new one.
- The bot is one process and must stay running to answer clicks, so it needs an always-on host. Free hosts that sleep when idle will make buttons fail.
- It is not connected to the website's rooms: Discord games and website games are separate.