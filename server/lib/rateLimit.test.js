import { describe, it, expect } from "vitest";
import { createFailureLimiter } from "./rateLimit.js";

function limiter(overrides = {}) {
  const clock = { t: 1_000_000 };
  const l = createFailureLimiter({ limit: 3, windowMs: 60_000, now: () => clock.t, ...overrides });
  return { l, clock };
}

describe("createFailureLimiter", () => {
  it("lets a new key try", () => {
    expect(limiter().l.retryAfterMs("a")).toBe(0);
  });

  it("allows up to the limit, then blocks", () => {
    const { l } = limiter();
    for (let i = 0; i < 2; i++) l.recordFailure("a");
    expect(l.retryAfterMs("a")).toBe(0); // 2 failures: one try left
    l.recordFailure("a");
    expect(l.retryAfterMs("a")).toBeGreaterThan(0); // 3 failures: blocked
  });

  it("tells you how long to wait, counting down", () => {
    const { l, clock } = limiter();
    for (let i = 0; i < 3; i++) l.recordFailure("a");
    expect(l.retryAfterMs("a")).toBe(60_000);
    clock.t += 45_000;
    expect(l.retryAfterMs("a")).toBe(15_000);
  });

  it("lets the key try again once the failures age out", () => {
    const { l, clock } = limiter();
    for (let i = 0; i < 3; i++) l.recordFailure("a");
    clock.t += 60_001;
    expect(l.retryAfterMs("a")).toBe(0);
  });

  it("is a sliding window: old failures drop off one at a time", () => {
    const { l, clock } = limiter();
    l.recordFailure("a"); clock.t += 30_000;
    l.recordFailure("a"); l.recordFailure("a"); // blocked now
    expect(l.retryAfterMs("a")).toBe(30_000);   // until the FIRST one is 60s old
    clock.t += 30_001;
    expect(l.retryAfterMs("a")).toBe(0);        // first aged out: 2 left in the window
  });

  it("keeps keys separate", () => {
    const { l } = limiter();
    for (let i = 0; i < 3; i++) l.recordFailure("a");
    expect(l.retryAfterMs("a")).toBeGreaterThan(0);
    expect(l.retryAfterMs("b")).toBe(0);
  });

  it("never remembers more than maxKeys keys", () => {
    const { l } = limiter({ maxKeys: 50 });
    for (let i = 0; i < 500; i++) l.recordFailure(`attacker-${i}`);
    // the newest keys are still tracked, the oldest were dropped
    for (let i = 0; i < 3; i++) l.recordFailure("recent");
    expect(l.retryAfterMs("recent")).toBeGreaterThan(0);
    expect(l.retryAfterMs("attacker-0")).toBe(0);
  });
});
