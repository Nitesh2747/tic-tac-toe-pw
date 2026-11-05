// Starts the Tic Tac Toe Discord bot.
import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleInteraction } from "./discord/interactions.js";
import { IDLE_MINUTES, closeIdleGames } from "./discord/expire.js";
import { createStore } from "./game/store.js";
import { createCooldown } from "./game/cooldown.js";
import { isOpenEntry } from "./game/challenge.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// "Intents" say which kinds of events the bot wants to hear about. Guilds (Discord's
// word for servers) is the minimum, and slash commands and buttons need nothing more.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// The games in progress, by the id of the Discord message that shows them. A game
// nobody has touched for IDLE_MINUTES is closed. They live in memory only, so a
// restart forgets them (like the website's rooms).
const games = createStore({ idleMs: IDLE_MINUTES * 60_000, isOpen: isOpenEntry });

// Each person may start a game or challenge only once every few seconds.
const cooldown = createCooldown({ ms: 3000 });

// Runs once, when the bot has connected and is ready.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  // Once a minute, close the boards nobody is playing any more.
  setInterval(() => closeIdleGames(games, client), 60_000);
});

// Runs every time someone uses a slash command or clicks a button.
client.on(Events.InteractionCreate, (interaction) => handleInteraction(interaction, games, cooldown));

// Without these, one unlucky network error could crash the whole bot.
client.on(Events.Error, (error) => console.error("Discord client error:", error));
process.on("unhandledRejection", (error) => console.error("Unhandled rejection:", error));

// Ctrl+C or a host stopping the bot: disconnect cleanly.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`${signal}: shutting down`);
    await client.destroy();
    process.exit(0);
  });
}

client.login(token).catch((error) => {
  console.error("Could not log in:", error.message);
  process.exit(1);
});
