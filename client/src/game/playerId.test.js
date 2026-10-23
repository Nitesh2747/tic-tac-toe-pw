import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { webcrypto } from "node:crypto";

// Node has no localStorage, so tests use a small in-memory stand-in.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Load a fresh copy of the module each time (it keeps a little state).
async function load() {
  vi.resetModules();
  return (await import("./playerId.js")).getPlayerId;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => vi.unstubAllGlobals());

describe("getPlayerId", () => {
  it("uses randomUUID where it exists (https and localhost)", async () => {
    const getPlayerId = await load();
    expect(getPlayerId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("still works on a plain http:// page, where randomUUID is undefined", async () => {
    vi.stubGlobal("crypto", { getRandomValues: (array) => webcrypto.getRandomValues(array) });
    const getPlayerId = await load();
    const id = getPlayerId();
    expect(id).toMatch(UUID_V4); // the same shape the secure path produces
    expect(id.length).toBeLessThanOrEqual(64); // the server accepts ids up to 64 characters
  });

  it("builds valid version-4 UUIDs on the fallback path, every time", async () => {
    vi.stubGlobal("crypto", { getRandomValues: (array) => webcrypto.getRandomValues(array) });
    for (let i = 0; i < 500; i++) {
      vi.stubGlobal("localStorage", fakeStorage());
      expect((await load())()).toMatch(UUID_V4);
    }
  });

  it("generates a different id for each browser", async () => {
    vi.stubGlobal("crypto", { getRandomValues: (array) => webcrypto.getRandomValues(array) });
    const ids = new Set();
    for (let i = 0; i < 200; i++) {
      vi.stubGlobal("localStorage", fakeStorage());
      const getPlayerId = await load();
      ids.add(getPlayerId());
    }
    expect(ids.size).toBe(200);
  });

  it("keeps the same id across calls and page loads", async () => {
    const first = (await load())();
    expect((await load())()).toBe(first); // a "reload": fresh module, same storage
  });

  it("keeps the id it already had", async () => {
    localStorage.setItem("ttt-player-id", "existing-id");
    expect((await load())()).toBe("existing-id");
  });

  it("still works, with a stable id, when the browser blocks storage", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    const getPlayerId = await load();
    const id = getPlayerId();
    expect(id.length).toBeGreaterThan(8);
    expect(getPlayerId()).toBe(id);
  });
});
