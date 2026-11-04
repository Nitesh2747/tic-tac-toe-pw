// The slash commands the bot offers. deploy-commands.js sends this description to Discord once. index.js answers the commands when people use them.
import { SlashCommandBuilder } from "discord.js";

const tictactoe = new SlashCommandBuilder()
    .setName("ttt")
    .setDescription("Play Tic Tac Toe with buttons")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("computer")
            .setDescription("Play against the computer")
            .addStringOption((option) =>
                option
                    .setName("level")
                    .setDescription("How good the computer is (default: medium)")
                    .addChoices(
                        { name: "Easy", value: "easy" },
                        { name: "Medium", value: "medium" },
                        { name: "Hard", value: "hard" },
                    ),
            ),
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("challenge")
            .setDescription("Challenge someone in this channel")
            .addUserOption((option) =>
                option.setName("opponent").setDescription("Who do you want to play?").setRequired(true),
            ),
    );

// convert the builders to plain JSON for Discord
export const commands = [tictactoe.toJSON()];