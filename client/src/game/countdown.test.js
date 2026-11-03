import { describe, it, expect } from "vitest";
import { secondsLeft, fractionLeft, URGENT_SECONDS } from "./countdown.js";

describe("secondsLeft", () => {
  it("rounds UP, so the last second shows as 1, never 0", () => {
    expect(secondsLeft(15000)).toBe(15);
    expect(secondsLeft(14001)).toBe(15);
    expect(secondsLeft(14000)).toBe(14);
    expect(secondsLeft(1)).toBe(1);
    expect(secondsLeft(999)).toBe(1);
  });
  it("is 0 only when the time is really up, and never negative", () => {
    expect(secondsLeft(0)).toBe(0);
    expect(secondsLeft(-500)).toBe(0);
  });
  it("is null when there is no clock", () => {
    expect(secondsLeft(null)).toBeNull();
    expect(secondsLeft(undefined)).toBeNull();
  });
});

describe("fractionLeft", () => {
  it("goes from 1 (a full turn) to 0 (time up)", () => {
    expect(fractionLeft(15000, 15000)).toBe(1);
    expect(fractionLeft(7500, 15000)).toBe(0.5);
    expect(fractionLeft(0, 15000)).toBe(0);
  });
  it("stays between 0 and 1 even with odd input", () => {
    expect(fractionLeft(20000, 15000)).toBe(1);
    expect(fractionLeft(-1, 15000)).toBe(0);
  });
  it("is 0 with no clock or no total (nothing to draw)", () => {
    expect(fractionLeft(null, 15000)).toBe(0);
    expect(fractionLeft(5000, null)).toBe(0);
    expect(fractionLeft(5000, 0)).toBe(0);
  });
});

describe("URGENT_SECONDS", () => {
  it("is short enough to matter in a 15 second turn", () => {
    expect(URGENT_SECONDS).toBeGreaterThan(0);
    expect(URGENT_SECONDS).toBeLessThan(15);
  });
});
