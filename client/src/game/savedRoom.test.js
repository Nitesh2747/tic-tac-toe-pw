import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getSavedRoom, getLastRoom, saveRoom, clearSavedRoom } from "./savedRoom.js";

// Node has no browser storage, so tests use small in-memory stand-ins.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// A browser with cookies blocked: even READING the global `localStorage` throws.
function blockStorage() {
  for (const name of ["localStorage", "sessionStorage"]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  }
}

let session, local;
beforeEach(() => {
  session = fakeStorage();
  local = fakeStorage();
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("localStorage", local);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

describe("saved room", () => {
  it("remembers nothing at first", () => {
    expect(getSavedRoom()).toBeNull();
    expect(getLastRoom()).toBeNull();
  });

  it("saveRoom remembers the room for this tab AND as the last room", () => {
    saveRoom("ROOM123456");
    expect(getSavedRoom()).toBe("ROOM123456");
    expect(getLastRoom()).toBe("ROOM123456");
  });

  it("after the tab is closed, only the last room is left (that is what offers Rejoin)", () => {
    saveRoom("ROOM123456");
    session.removeItem("ttt-room-id"); // a new tab starts with an empty sessionStorage
    expect(getSavedRoom()).toBeNull();
    expect(getLastRoom()).toBe("ROOM123456");
  });

  it("clearSavedRoom forgets both (leaving, or being removed by the host)", () => {
    saveRoom("ROOM123456");
    clearSavedRoom();
    expect(getSavedRoom()).toBeNull();
    expect(getLastRoom()).toBeNull();
  });
});

describe("when the browser blocks storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    blockStorage();
  });

  it("nothing throws, and nothing is remembered", () => {
    expect(() => saveRoom("ROOM123456")).not.toThrow();
    expect(() => clearSavedRoom()).not.toThrow();
    expect(getSavedRoom()).toBeNull();
    expect(getLastRoom()).toBeNull();
  });
});
