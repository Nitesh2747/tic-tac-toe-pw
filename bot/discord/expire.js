// Closes the boards nobody is playing any more: their buttons are removed and the message says why, so nobody clicks a board the bot has already forgotten.
import { describeBoard } from "../game/board.js";
import { toClosedMessage } from "./render.js";

export const IDLE_MINUTES = 5;

function expiredText(entry) {
  if (entry.pending) return `<@${entry.challenger}>'s challenge to <@${entry.opponent}> expired.`;
  return `${describeBoard(entry).content}\n⌛ Closed after ${IDLE_MINUTES} minutes without a move.`;
}

// Takes the idle entries out of the store and edits their messages.
// A failure to edit one (message deleted, no permission...) never stops the others.
export async function closeIdleGames(store, client) {
  for (const { id, entry, meta } of store.takeExpired()) {
    try {
      const channel = await client.channels.fetch(meta.channelId);
      await channel.messages.edit(id, toClosedMessage(expiredText(entry)));
    } catch (error) {
      console.warn(`Could not close message ${id}: ${error.message}`);
    }
  }
}