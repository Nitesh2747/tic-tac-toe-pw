// Handles what happens when someone uses /ttt or clicks a button.
// index.js only connects to Discord and hands every interaction to handleInteraction,
// so everything in here can be tested with fake interaction objects.
import { MessageFlags } from "discord.js";
import { COMPUTER, createGame, playMove, rematch, resign, seatOf } from "../game/game.js";
import { MOVE_PREFIX, REMATCH_ID, RESIGN_ID } from "../game/board.js";
import {
  ACCEPT_ID,
  DECLINE_ID,
  acceptChallenge,
  closeChallenge,
  createChallenge,
} from "../game/challenge.js";
import { noCooldown } from "../game/cooldown.js";
import { toChallengeMessage, toClosedMessage, toMessage } from "./render.js";

// "ttt:move:4" -> 4. Anything else (wrong prefix, "ttt:move:99", "ttt:move:1x") -> null.
// Button ids come from Discord, but a custom id is still outside input: never trust it.
export function parseMoveId(customId) {
  if (typeof customId !== "string" || !customId.startsWith(MOVE_PREFIX)) return null;
  const text = customId.slice(MOVE_PREFIX.length);
  if (!/^[0-8]$/.test(text)) return null;
  return Number(text);
}

// A reply only the person who clicked can see.
const privately = (content) => ({ content, flags: MessageFlags.Ephemeral });

// Posts a message and remembers what it stands for (a game or a challenge), keyed by the
// id of the message, which is how a later click finds it again. The channel is kept too,
// so the bot can close the message later if nobody plays on.
async function postAndRemember(interaction, games, message, entry) {
  await interaction.reply(message);
  const posted = await interaction.fetchReply();
  games.set(posted.id, entry, { channelId: interaction.channelId, ownerId: interaction.user.id });
}

// Starting something costs memory, so it is limited: one start per few seconds, and only
// so many open at once. Returns a private refusal to send, or null if it may go ahead.
function refuseStart(interaction, games, cooldown) {
  const wait = cooldown.use(interaction.user.id);
  if (wait > 0) return privately(`Slow down! Try again in ${Math.ceil(wait / 1000)} seconds.`);
  const check = games.canStart(interaction.user.id);
  if (!check.ok) return privately(check.error);
  return null;
}

async function startComputerGame(interaction, games, cooldown) {
  const refusal = refuseStart(interaction, games, cooldown);
  if (refusal) return interaction.reply(refusal);
  const level = interaction.options.getString("level") ?? "medium";
  const game = createGame({ x: interaction.user.id, o: COMPUTER, level });
  await postAndRemember(interaction, games, toMessage(game), game);
}

async function startChallenge(interaction, games, cooldown) {
  const opponent = interaction.options.getUser("opponent");
  if (opponent.id === interaction.user.id) {
    return interaction.reply(privately("You can't challenge yourself. Try /ttt computer."));
  }
  if (opponent.bot) {
    return interaction.reply(privately("Bots can't play. Try /ttt computer to play the computer."));
  }
  const alreadyWaiting = games.some(
    (entry) => entry.pending && entry.challenger === interaction.user.id && entry.opponent === opponent.id
  );
  if (alreadyWaiting) {
    return interaction.reply(privately("You already have a challenge waiting for them."));
  }
  const refusal = refuseStart(interaction, games, cooldown);
  if (refusal) return interaction.reply(refusal);

  const challenge = createChallenge({ challenger: interaction.user.id, opponent: opponent.id });
  await postAndRemember(interaction, games, toChallengeMessage(challenge), challenge);
}

async function handleMove(interaction, games, index) {
  const game = games.get(interaction.message.id);
  if (!game) {
    return interaction.reply(
      privately("This game isn't active any more. Start a new one with /ttt.")
    );
  }
  if (game.pending) return interaction.reply(privately("This challenge hasn't been accepted yet."));

  const result = playMove(game, interaction.user.id, index);
  if (!result.ok) return interaction.reply(privately(result.error));

  games.set(interaction.message.id, result.game);
  // update() edits the message the button belongs to, which also answers the click.
  return interaction.update(toMessage(result.game));
}

// Resign and Play again: look the game up, run the rule, and show the result.
async function handleControl(interaction, games, id) {
  const game = games.get(interaction.message.id);
  if (!game || game.pending) {
    return interaction.reply(privately("This game isn't active any more. Start a new one with /ttt."));
  }
  const userId = interaction.user.id;
  if (!seatOf(game, userId)) return interaction.reply(privately("You're not playing in this game."));

  const result = id === RESIGN_ID ? resign(game, userId) : rematch(game);
  if (!result.ok) return interaction.reply(privately(result.error));
  games.set(interaction.message.id, result.game);
  return interaction.update(toMessage(result.game));
}

async function handleChallengeButton(interaction, games, accepting) {
  const challenge = games.get(interaction.message.id);
  if (!challenge?.pending) {
    return interaction.reply(privately("This challenge isn't active any more."));
  }

  if (accepting) {
    const result = acceptChallenge(challenge, interaction.user.id);
    if (!result.ok) return interaction.reply(privately(result.error));
    games.set(interaction.message.id, result.game); // the challenge turns into a game
    return interaction.update(toMessage(result.game));
  }

  const result = closeChallenge(challenge, interaction.user.id);
  if (!result.ok) return interaction.reply(privately(result.error));
  games.delete(interaction.message.id);
  return interaction.update(toClosedMessage(result.text));
}

export async function handleInteraction(interaction, games, cooldown = noCooldown) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "ttt") return;
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "computer") return await startComputerGame(interaction, games, cooldown);
      if (subcommand === "challenge") return await startChallenge(interaction, games, cooldown);
      return;
    }
    if (interaction.isButton()) {
      if (interaction.customId === ACCEPT_ID) return await handleChallengeButton(interaction, games, true);
      if (interaction.customId === DECLINE_ID) return await handleChallengeButton(interaction, games, false);
      if (interaction.customId === RESIGN_ID || interaction.customId === REMATCH_ID) {
        return await handleControl(interaction, games, interaction.customId);
      }
      const index = parseMoveId(interaction.customId);
      if (index === null) return;
      return await handleMove(interaction, games, index);
    }
  } catch (error) {
    // One failed call must not take the whole bot down.
    console.error("Interaction failed:", error);
    // Tell the person something went wrong instead of leaving "This interaction failed".
    // (If we already answered, or even this reply fails, there is nothing more to do.)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(privately("Something went wrong. Please try again.")).catch(() => {});
    }
  }
}
