// Sends the slash command list to Discord. Runs once and again whenever commands.js changes (npm run deploy)
import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "../discord/commands.js";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID. Check your .env file.");
    process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);

try {
    // "put" replaces the server's whole command list with this one.
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`Registered ${commands.length} command(s) in your test server.`);
} catch (error) {
    console.error("Could not register commands:", error.message);
    process.exit(1);
}