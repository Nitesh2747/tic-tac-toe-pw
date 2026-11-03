// Helpers for showing the turn timer. The server sends the time REMAINING in
// milliseconds (never a clock time), so a wrong clock on your device cannot matter.

export const URGENT_SECONDS = 5; // the countdown turns red at this many seconds

// Whole seconds left, rounded UP: "1" stays on screen until the very end, and
// "0" never shows while there is still time. null means there is no clock.
export function secondsLeft(msLeft) {
  if (msLeft === null || msLeft === undefined) return null;
  return Math.max(0, Math.ceil(msLeft / 1000));
}

// How much of the turn is left, from 1 (all of it) down to 0.
export function fractionLeft(msLeft, totalMs) {
  if (msLeft === null || msLeft === undefined || !totalMs) return 0;
  return Math.min(1, Math.max(0, msLeft / totalMs));
}
