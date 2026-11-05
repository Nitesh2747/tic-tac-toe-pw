// Remembers the games and challenges in progress, forgets the ones nobody is using,
// and says no when one person (or everyone together) would be holding too many.
// It has the same get / set / delete as a Map, so the rest of the bot treats it like one.
// "Active" means someone did something that changed the entry (a move, an accept...).
// Looking at an entry, or a refused click, does not keep it alive.
// The clock is a parameter so tests can move time without waiting.

export function createStore({
  idleMs,
  now = Date.now,
  maxPerOwner = 3, // open games + pending challenges one person may have started
  maxTotal = 500, // everything the bot remembers, all people together
  isOpen = () => true, // does this entry still count toward maxPerOwner? (finished games should not)
}) {
  const entries = new Map(); // id -> { entry, lastActive, meta }

  return {
    get(id) {
      return entries.get(id)?.entry;
    },
    // `meta` (for example { channelId, ownerId }) is only given when something is first
    // stored, and is kept as it is when the entry is replaced by its next version.
    set(id, entry, meta) {
      const previous = entries.get(id);
      entries.set(id, { entry, lastActive: now(), meta: meta ?? previous?.meta ?? {} });
      return this;
    },
    meta(id) {
      return entries.get(id)?.meta;
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
    // Is there any entry for which predicate(entry, meta) is true?
    some(predicate) {
      for (const { entry, meta } of entries.values()) if (predicate(entry, meta)) return true;
      return false;
    },
    // May this person start something new? { ok: true } or { ok: false, error }.
    canStart(ownerId) {
      if (entries.size >= maxTotal) {
        return { ok: false, error: "The bot is busy right now. Please try again in a few minutes." };
      }
      let open = 0;
      for (const { entry, meta } of entries.values()) {
        if (meta.ownerId === ownerId && isOpen(entry)) open += 1;
      }
      if (open >= maxPerOwner) {
        return {
          ok: false,
          error: `You already have ${maxPerOwner} games or challenges open. Finish or resign one first.`,
        };
      }
      return { ok: true };
    },
    // Removes everything idle for longer than idleMs and returns it, so the caller can
    // tell the people involved: [{ id, entry, meta }].
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
