import { describe, it, expect } from "vitest";
import { getWinLine, getTileCenter, BOARD_SIZE } from "./winLine.js";
import { WINNING_LINES } from "./logic.js";

describe("getWinLine", () => {
  it("returns null when there is no winning line", () => {
    expect(getWinLine([])).toBeNull();
    expect(getWinLine(undefined)).toBeNull();
    expect(getWinLine([0, 1])).toBeNull();
  });

  it("draws rows horizontally, left to right", () => {
    for (const row of [[0, 1, 2], [3, 4, 5], [6, 7, 8]]) {
      const l = getWinLine(row);
      expect(l.y1).toBeCloseTo(l.y2);
      expect(l.x2).toBeGreaterThan(l.x1);
    }
  });

  it("draws columns vertically, top to bottom", () => {
    for (const col of [[0, 3, 6], [1, 4, 7], [2, 5, 8]]) {
      const l = getWinLine(col);
      expect(l.x1).toBeCloseTo(l.x2);
      expect(l.y2).toBeGreaterThan(l.y1);
    }
  });

  it("draws the main diagonal down-right and the other one down-left", () => {
    const main = getWinLine([0, 4, 8]);
    expect(main.x2).toBeGreaterThan(main.x1);
    expect(main.y2).toBeGreaterThan(main.y1);
    const anti = getWinLine([2, 4, 6]);
    expect(anti.x2).toBeLessThan(anti.x1);
    expect(anti.y2).toBeGreaterThan(anti.y1);
  });

  it("passes through the exact centre of the middle tile", () => {
    for (const line of WINNING_LINES) {
      const l = getWinLine(line);
      const middle = getTileCenter(line[1]);
      expect((l.x1 + l.x2) / 2).toBeCloseTo(middle.x);
      expect((l.y1 + l.y2) / 2).toBeCloseTo(middle.y);
    }
  });

  it("always stays inside the board, and reports its own length", () => {
    for (const line of WINNING_LINES) {
      const l = getWinLine(line);
      for (const v of [l.x1, l.y1, l.x2, l.y2]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(BOARD_SIZE);
      }
      expect(l.length).toBeCloseTo(Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
    }
  });
});
