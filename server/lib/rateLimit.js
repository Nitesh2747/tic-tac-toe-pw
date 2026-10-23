// Counts failures per key (a connection, an IP address) inside a sliding window.
//
// Used for wrong private-room codes. It counts only FAILURES, and callers check
// it BEFORE looking at the code, so a blocked client learns nothing: even the
// right code is refused until the block ends.
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

  return {
    // Milliseconds until this key may try again. 0 means it may try now.
    retryAfterMs(key) {
      const list = recent(key);
      if (list.length < limit) return 0;
      return windowMs - (now() - list[list.length - limit]);
    },

    recordFailure(key) {
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
      if (failures.size > maxKeys) prune();
    },
  };
}
