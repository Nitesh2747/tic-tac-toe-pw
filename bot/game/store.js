// Remembers the games and challenges in progress, and forgets the ones nobody is using.
// It has the same get / set / delete as a Map, so the rest of the bot treats it like one.
// "Active" means someone did something that changed the entry (a move, an accept...).
// Looking at an entry, or a refused click, does not keep it alive.
// The clock is a parameter so tests can move time without waiting.

export function createStore({ idleMs, now = Date.now }) {
  const entries = new Map(); // id -> { entry, lastActive, meta }

  return {
    get(id) {
      return entries.get(id)?.entry;
    },
    // `meta` (for example { channelId }) is only given when something is first stored, and is kept as it is when the entry is replaced by its next version.
    set(id, entry, meta) {
      const previous = entries.get(id);
      entries.set(id, { entry, lastActive: now(), meta: meta ?? previous?.meta ?? {} });
      return this;
    },
    delete(id) {
      return entries.delete(id);
    },
    has(id) {
      return entries.has(id);
    },
    get size() {
      return entries.size;
    },
    // Removes everything idle for longer than idleMs and returns it, so the caller can tell the people involved: [{ id, entry, meta }].
    takeExpired() {
      const expired = [];
      for (const [id, item] of entries) {
        if (now() - item.lastActive > idleMs) {
          expired.push({ id, entry: item.entry, meta: item.meta });
          entries.delete(id);
        }
      }
      return expired;
    },
  };
}
