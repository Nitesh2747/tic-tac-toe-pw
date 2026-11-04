// Starts the Tic Tac Toe Discord bot.
import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleInteraction } from "./interactions.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const games = new Map();

// Runs once, when the bot has connected and is ready.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Runs every time someone uses a slash command or clicks a button.
client.on(Events.InteractionCreate, (interaction) => handleInteraction(interaction, games));

client.login(token).catch((error) => {
  console.error("Could not log in:", error.message);
  process.exit(1);
});