// Starts the Tic Tac Toe Discord bot.
import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// "Intents" say which kinds of events the bot wants to hear about. Guilds/servers is the minimum, and slash commands and buttons need nothing more.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Runs once, when the bot has connected and is ready.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token).catch((error) => {
  console.error("Could not log in:", error.message);
  process.exit(1);
});