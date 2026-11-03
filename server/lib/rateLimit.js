// Counts events per key (a connection, an IP address, a player) inside a sliding
// window, and says when a key has used up its allowance.
//
// Used for wrong private-room codes (it counts only FAILURES, and callers check it
// BEFORE looking at the code, so a blocked client learns nothing: even the right
// code is refused until the block ends) and for chat messages per player.
export function createFailureLimiter({ limit, windowMs, now = () => Date.now(), maxKeys = 10_000 }) {
  const failures = new Map(); // key -> timestamps of recent failures, oldest first

  function recent(key) {
    const t = now();
    const list = (failures.get(key) ?? []).filter((time) => t - time < windowMs);
    if (list.length > 0) failures.set(key, list);
    else failures.delete(key);
    return list;
  }

  // Never let the table grow without bound (an attacker can invent many keys).
  function prune() {
    for (const key of [...failures.keys()]) recent(key);
    while (failures.size > maxKeys) failures.delete(failures.keys().next().value);
  }

  const limiter = {
    // Milliseconds until this key may try again. 0 means it may try now.
    retryAfterMs(key) {
      const list = recent(key);
      if (list.length < limit) return 0;
      return windowMs - (now() - list[list.length - limit]);
    },

    // Count one event for this key (recordFailure is the same thing, for callers counting failures).
    record(key) {
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
      if (failures.size > maxKeys) prune();
    },
  };
  limiter.recordFailure = limiter.record;
  return limiter;
}

// The same thing under a name that reads better where it counts successes.
export const createEventLimiter = createFailureLimiter;
