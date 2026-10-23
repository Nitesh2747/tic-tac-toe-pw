import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cleanName,
  isValidName,
  isAvatarSeed,
  isValidRoomName,
  newAvatarSeed,
  loadProfile,
  saveProfile,
} from "./profile.js";

// Same cases as server/lib/profile.test.js: the two copies must agree.
describe("cleanName (must match the server)", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
  });
  it("removes control, zero-width and bidirectional-override characters", () => {
    expect(cleanName("Ev\u0000il")).toBe("Evil");
    expect(cleanName("Zero\u200BWidth")).toBe("ZeroWidth");
    expect(cleanName("\u202Egnirps")).toBe("gnirps");
    expect(cleanName("line\u2028sep")).toBe("linesep");
  });
  it("normalizes unicode", () => {
    expect(cleanName("Cafe\u0301")).toBe("Caf\u00e9");
  });
  it("keeps letters from any language, digits, punctuation and emoji", () => {
    expect(cleanName("Zoë_99")).toBe("Zoë_99");
    expect(cleanName("田中さん")).toBe("田中さん");
    expect(cleanName("Sam 😀")).toBe("Sam 😀");
  });
  it("returns an empty string for anything that is not a short string", () => {
    for (const bad of [null, undefined, 42, {}, [], true, "x".repeat(65)]) {
      expect(cleanName(bad)).toBe("");
    }
  });
});

describe("isValidName", () => {
  it("accepts 2 to 16 characters, counting an emoji as one", () => {
    expect(isValidName("ab")).toBe(true);
    expect(isValidName("a".repeat(16))).toBe(true);
    expect(isValidName("😀".repeat(16))).toBe(true);
  });
  it("rejects 0, 1 and 17 characters", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName("a")).toBe(false);
    expect(isValidName("a".repeat(17))).toBe(false);
    expect(isValidName("😀".repeat(17))).toBe(false);
  });
});

describe("isValidRoomName (must match the server)", () => {
  it("accepts 2 to 24 characters, counting an emoji as one", () => {
    expect(isValidRoomName("ab")).toBe(true);
    expect(isValidRoomName("a".repeat(24))).toBe(true);
    expect(isValidRoomName("😀".repeat(24))).toBe(true);
  });
  it("rejects 1 and 25", () => {
    expect(isValidRoomName("a")).toBe(false);
    expect(isValidRoomName("a".repeat(25))).toBe(false);
  });
});

describe("newAvatarSeed", () => {
  it("produces seeds the server accepts", () => {
    for (let i = 0; i < 50; i++) expect(isAvatarSeed(newAvatarSeed())).toBe(true);
  });
  it("produces different seeds each time", () => {
    const seeds = new Set(Array.from({ length: 500 }, newAvatarSeed));
    expect(seeds.size).toBe(500);
  });
});

// Node has no localStorage, so tests use a small in-memory stand-in.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

describe("saving and loading", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns null when nothing is saved", () => {
    expect(loadProfile()).toBeNull();
  });

  it("round-trips a profile, cleaning the name on the way in", () => {
    const saved = saveProfile({ name: "  Ada  ", avatarSeed: "abcdef0123456789" });
    expect(saved).toEqual({ name: "Ada", avatarSeed: "abcdef0123456789" });
    expect(loadProfile()).toEqual(saved);
  });

  it("ignores corrupted or hand-edited storage", () => {
    for (const bad of ["not json", "null", '{"name":"x","avatarSeed":"abcdef0123456789"}', '{"name":"Ada","avatarSeed":"<bad>"}', "[]"]) {
      localStorage.setItem("ttt-profile", bad);
      expect(loadProfile()).toBeNull();
    }
  });

  it("does not crash when storage is blocked (private mode)", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    vi.stubGlobal("localStorage", blocked);
    expect(loadProfile()).toBeNull();
    expect(saveProfile({ name: "Ada", avatarSeed: "abcdef0123456789" })).toEqual({
      name: "Ada",
      avatarSeed: "abcdef0123456789",
    });
  });
});
