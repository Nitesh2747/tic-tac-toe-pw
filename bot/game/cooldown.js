// "Not again so soon": each person may start something once per `ms`.
// use(key) returns 0 and starts the wait if the person may go ahead, or the number of
// milliseconds still to wait. The clock is a parameter so tests can move time.
export function createCooldown({ ms, now = Date.now, maxKeys = 5000 }) {
  const last = new Map(); // key -> when they last went ahead

  return {
    use(key) {
      const t = now();
      const wait = ms - (t - (last.get(key) ?? -Infinity));
      if (wait > 0) return wait;
      last.set(key, t);
      if (last.size > maxKeys) {
        for (const [other, time] of last) if (t - time >= ms) last.delete(other); // forget the finished waits
      }
      return 0;
    },
    get size() {
      return last.size;
    },
  };
}

// For callers (and tests) that do not want a wait.
export const noCooldown = { use: () => 0 };
