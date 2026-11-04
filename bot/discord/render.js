// Turns a game into a real Discord message: the text plus clickable buttons.
// The decisions about WHAT to show are made in game/board.js; this file only
// builds the Discord objects from them.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { describeBoard } from "../game/board.js";
import { describeChallenge } from "../game/challenge.js";

const STYLES = {
  primary: ButtonStyle.Primary, // blue
  secondary: ButtonStyle.Secondary, // grey
  success: ButtonStyle.Success, // green
  danger: ButtonStyle.Danger, // red
};

function toButton({ customId, label, style, disabled }) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(STYLES[style])
    .setDisabled(disabled);
}

// The object you pass to interaction.reply(...) or interaction.update(...).
export function toMessage(game) {
  const { content, rows, controls } = describeBoard(game);
  return {
    content,
    // Three rows of squares, then a row with Resign / Play again (Discord allows 5 rows).
    components: [...rows, controls].map((row) => new ActionRowBuilder().addComponents(row.map(toButton))),
    // Show names for the mentions, but never ping anyone because a board changed.
    allowedMentions: { parse: [] },
  };
}

// The "A challenges B" message. Unlike a board, this one DOES notify the challenged person.
export function toChallengeMessage(challenge) {
  const { content, buttons } = describeChallenge(challenge);
  return {
    content,
    components: [new ActionRowBuilder().addComponents(buttons.map(toButton))],
    allowedMentions: { users: [challenge.opponent] },
  };
}

// A message that has ended (declined, cancelled): text only, no buttons left to click.
export function toClosedMessage(text) {
  return { content: text, components: [], allowedMentions: { parse: [] } };
}
