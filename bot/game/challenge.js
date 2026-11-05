// A challenge: "A asks B to play". Pure data and rules, no Discord code in here.
// It lives until B accepts (it becomes a game), or B declines, or A cancels.
import { createGame, getResult } from "./game.js";

export const ACCEPT_ID = "ttt:accept";
export const DECLINE_ID = "ttt:decline";

const fail = (error) => ({ ok: false, error });

// `pending: true` is how the rest of the bot tells a challenge from a game.
export function createChallenge({ challenger, opponent }) {
  if (challenger === opponent) throw new Error("A challenge needs two different players");
  return { pending: true, challenger, opponent };
}

// Only the challenged person can accept. The challenger plays X and starts.
export function acceptChallenge(challenge, userId) {
  if (userId !== challenge.opponent) return fail("Only the challenged player can accept.");
  return { ok: true, game: createGame({ x: challenge.challenger, o: challenge.opponent }) };
}

// The challenged person declines; the challenger can take it back (cancel).
// Anyone else is refused. `text` is what the message turns into.
export function closeChallenge(challenge, userId) {
  const { challenger, opponent } = challenge;
  if (userId === opponent) return { ok: true, text: `<@${opponent}> declined the challenge from <@${challenger}>.` };
  if (userId === challenger) return { ok: true, text: `<@${challenger}> cancelled the challenge.` };
  return fail("This challenge isn't for you.");
}

// What to show, in the same shape as board.js: text plus button descriptions.
export function describeChallenge(challenge) {
  return {
    content: `<@${challenge.challenger}> challenges <@${challenge.opponent}> to Tic Tac Toe!\n<@${challenge.opponent}>, do you accept?`,
    buttons: [
      { customId: ACCEPT_ID, label: "Accept", style: "success", disabled: false },
      { customId: DECLINE_ID, label: "Decline", style: "danger", disabled: false },
    ],
  };
}

// Does this stored thing (a challenge or a game) still count as "open" for a person's
// limit? A challenge waiting for an answer does; a game does until its round is over.
export function isOpenEntry(entry) {
  return Boolean(entry.pending) || !getResult(entry).over;
}
