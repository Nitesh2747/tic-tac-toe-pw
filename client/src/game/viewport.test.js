import { describe, it, expect } from "vitest";
import { keyboardInset } from "./viewport.js";

const visual = (height, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale });

describe("keyboardInset", () => {
  it("is 0 when nothing covers the page", () => {
    expect(keyboardInset(873, visual(873))).toBe(0);
  });

  it("is the keyboard's height when it shrinks the visible area", () => {
    expect(keyboardInset(873, visual(508))).toBe(365);
  });

  it("counts a page that the browser scrolled while the keyboard is open", () => {
    // visible area runs from 120 down to 628: the bottom 245px of the page are hidden
    expect(keyboardInset(873, visual(508, 120))).toBe(245);
  });

  it("is 0 when the visible area is scrolled to the very bottom of a keyboard-free page", () => {
    expect(keyboardInset(873, visual(873, 0))).toBe(0);
  });

  it("never goes negative, whatever the browser reports", () => {
    expect(keyboardInset(800, visual(900))).toBe(0);
    expect(keyboardInset(800, visual(800, 50))).toBe(0);
  });

  it("is 0 when the browser does not report a visual viewport at all", () => {
    expect(keyboardInset(873, null)).toBe(0);
    expect(keyboardInset(873, undefined)).toBe(0);
  });

  it("ignores pinch-zoom: zooming in shrinks the visible area but is not a keyboard", () => {
    expect(keyboardInset(873, visual(436, 100, 2))).toBe(0);
  });

  it("rounds to whole pixels", () => {
    expect(keyboardInset(873, visual(507.6))).toBe(365);
  });
});
