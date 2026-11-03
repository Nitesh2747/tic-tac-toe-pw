// Small pure helpers for the chat. The server decides what a message is; these
// only keep the list tidy and work out what to show.

export const CHAT_MAX = 200; // characters per message (the server enforces it too)
export const CHAT_HISTORY = 50; // messages kept per room

// Add a message to the list: ignore one we already have (the same id), and keep
// only the newest CHAT_HISTORY. Returns a NEW list.
export function appendMessage(list, message) {
  if (list.some((existing) => existing.id === message.id)) return list;
  const next = [...list, message];
  return next.length > CHAT_HISTORY ? next.slice(next.length - CHAT_HISTORY) : next;
}

// How many messages from the OTHER player have arrived since `seenId`.
// System lines ("Sam joined.") do not count: they are not worth a badge.
export function countUnread(messages, seenId, mySeat) {
  return messages.filter((m) => !m.system && m.seat !== mySeat && m.id > seenId).length;
}

// "14:05" in the reader's own time zone and style.
export function formatTime(at, locale) {
  return new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
