import { useEffect, useState } from "react";

// Counts down from `msLeft` (what the server said was left when it sent the
// state), updating about ten times a second. It starts over whenever the server
// sends a new state (`resetKey`), so it can never drift away from the server's
// clock. Returns the milliseconds left, or null when there is no clock.
export function useCountdown(msLeft, resetKey) {
  const [remaining, setRemaining] = useState(msLeft ?? null);

  useEffect(() => {
    if (msLeft === null || msLeft === undefined) {
      setRemaining(null);
      return;
    }
    const startedAt = performance.now();
    const update = () => setRemaining(Math.max(0, msLeft - (performance.now() - startedAt)));
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [msLeft, resetKey]);

  return remaining;
}
