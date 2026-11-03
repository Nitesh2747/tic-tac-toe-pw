// Chat messages. Each room keeps its last few messages in memory (room.chat).
//
// A message is { id, seat, name, avatarSeed, text, at } or, for a line the server
// writes itself ("Sam joined."), { id, system: true, text, at }. The sender's
// name and avatar come from the SERVER'S record of the seat they sit in, never
// from the client, so nobody can speak as someone else. No ids or secrets in it.
import { getRoleOf } from "../game/room.js";
import { getGameStatus } from "../game/logic.js";

export const CHAT_MAX = 200; // characters per message
export const CHAT_HISTORY = 50; // messages remembered per room

// Chat is plain text. Anything that is not a printable character is dropped, and
// all whitespace (new lines, tabs, runs of spaces) becomes a single space. The
// invisible "direction override" characters that can make text lie about itself
// are removed too. Returns "" if nothing is left.
export function cleanChatText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .trim();
}

function pushMessage(room, fields) {
  room.chatSeq += 1;
  const message = { id: room.chatSeq, ...fields };
  room.chat.push(message);
  while (room.chat.length > CHAT_HISTORY) room.chat.shift();
  return message;
}

// A line written by the server: someone joined or left, the round ended...
export function addSystemMessage(room, text, now = Date.now()) {
  return pushMessage(room, { system: true, text, at: now });
}

// Add a message from a player. Returns { ok: true, message } or { ok: false, error }.
export function postMessage(room, playerId, rawText, now = Date.now()) {
  const seat = getRoleOf(room, playerId);
  if (!seat) return { ok: false, error: "You are not in this room" };
  if (!room.players.X || !room.players.O) {
    return { ok: false, error: "Wait for someone to join first" };
  }
  if (typeof rawText !== "string") return { ok: false, error: "Invalid message" };
  if (rawText.length > 2000) {
    return { ok: false, error: `Messages can be up to ${CHAT_MAX} characters` };
  }

  const text = cleanChatText(rawText);
  if (text === "") return { ok: false, error: "Type a message first" };
  if ([...text].length > CHAT_MAX) {
    return { ok: false, error: `Messages can be up to ${CHAT_MAX} characters` };
  }

  const player = room.players[seat];
  return {
    ok: true,
    message: pushMessage(room, { seat, name: player.name, avatarSeed: player.avatarSeed, text, at: now }),
  };
}

// "Sam won the round!" / "The round was a draw." / null while the game goes on.
export function resultText(room) {
  const { winner, isDraw } = getGameStatus(room.board, room.xIsNext);
  if (winner) return `${room.players[winner]?.name ?? winner} won the round!`;
  if (isDraw) return "The round was a draw.";
  return null;
}

// Write a server line into the room's chat and tell everyone in the room.
export function announce(io, room, text) {
  io.to(room.id).emit("chat:message", addSystemMessage(room, text));
}

// If the last move ended the round, say so in the chat.
export function announceResult(io, room) {
  const text = resultText(room);
  if (text) announce(io, room, text);
}
