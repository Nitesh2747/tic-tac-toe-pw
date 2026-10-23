import { describe, it, expect } from "vitest";
import { cleanName, isValidName, isAvatarSeed, readProfile, isValidRoomName, readRoomSettings } from "./profile.js";

describe("cleanName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
    expect(cleanName("a\t\n b")).toBe("a b");
  });

  it("removes control, zero-width and bidirectional-override characters", () => {
    expect(cleanName("Ev\u0000il")).toBe("Evil");
    expect(cleanName("Zero\u200BWidth")).toBe("ZeroWidth");
    expect(cleanName("\u202Egnirps")).toBe("gnirps"); // right-to-left override
    expect(cleanName("line\u2028sep")).toBe("linesep");
  });

  it("normalizes unicode so lookalike encodings compare equal", () => {
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
  it("accepts 2 to 16 characters", () => {
    expect(isValidName("ab")).toBe(true);
    expect(isValidName("a".repeat(16))).toBe(true);
  });

  it("rejects 0, 1 and 17 characters", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName("a")).toBe(false);
    expect(isValidName("a".repeat(17))).toBe(false);
  });

  it("counts an emoji as one character, not two", () => {
    expect(isValidName("😀".repeat(16))).toBe(true);
    expect(isValidName("😀".repeat(17))).toBe(false);
  });
});

describe("isAvatarSeed", () => {
  it("accepts 8 to 32 lowercase letters and digits", () => {
    expect(isAvatarSeed("abcdef01")).toBe(true);
    expect(isAvatarSeed("a1b2c3d4e5f60718")).toBe(true);
    expect(isAvatarSeed("a".repeat(32))).toBe(true);
  });

  it("rejects everything else", () => {
    for (const bad of ["short", "a".repeat(33), "UPPERCASE1", "has space1", "semi;colon1", "", null, 12345678, {}]) {
      expect(isAvatarSeed(bad)).toBe(false);
    }
  });
});

describe("readProfile", () => {
  const seed = "abcdef0123456789";

  it("returns the cleaned name and the seed", () => {
    expect(readProfile({ name: "  Ada  ", avatarSeed: seed })).toEqual({ ok: true, name: "Ada", avatarSeed: seed });
  });

  it("rejects a bad name with a helpful message", () => {
    const r = readProfile({ name: "x", avatarSeed: seed });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/2 and 16/);
  });

  it("rejects a bad seed", () => {
    expect(readProfile({ name: "Ada", avatarSeed: "NOPE" })).toEqual({ ok: false, error: "Invalid avatar" });
  });

  it("rejects missing or non-object payloads without throwing", () => {
    for (const bad of [null, undefined, 42, "str", []]) {
      expect(readProfile(bad).ok).toBe(false);
    }
  });

  it("treats markup as plain text: it is kept as typed, and escaped when displayed", () => {
    const r = readProfile({ name: "<b>hi</b>", avatarSeed: seed });
    expect(r).toEqual({ ok: true, name: "<b>hi</b>", avatarSeed: seed });
  });
});

describe("isValidRoomName", () => {
  it("accepts 2 to 24 characters", () => {
    expect(isValidRoomName("ab")).toBe(true);
    expect(isValidRoomName("a".repeat(24))).toBe(true);
    expect(isValidRoomName("😀".repeat(24))).toBe(true);
  });
  it("rejects 1 and 25", () => {
    expect(isValidRoomName("a")).toBe(false);
    expect(isValidRoomName("a".repeat(25))).toBe(false);
  });
});

describe("readRoomSettings", () => {
  it("defaults to a public room called \"<host>'s room\"", () => {
    expect(readRoomSettings({}, "Ada")).toEqual({ ok: true, name: "Ada's room", visibility: "public" });
    expect(readRoomSettings(null, "Ada").ok).toBe(true);
  });
  it("uses the name and display it is given, cleaning the name", () => {
    expect(readRoomSettings({ roomName: "  Friday   night ", visibility: "private" }, "Ada")).toEqual({
      ok: true,
      name: "Friday night",
      visibility: "private",
    });
  });
  it("falls back to the default for an empty or invisible-characters-only name", () => {
    expect(readRoomSettings({ roomName: "" }, "Ada").name).toBe("Ada's room");
    expect(readRoomSettings({ roomName: "\u200B\u202E  " }, "Ada").name).toBe("Ada's room");
  });
  it("a default room name always fits the limit, even for the longest player name", () => {
    expect(isValidRoomName(readRoomSettings({}, "W".repeat(16)).name)).toBe(true);
    expect(isValidRoomName(readRoomSettings({}, "😀".repeat(16)).name)).toBe(true);
  });
  it("rejects a name that is too short or too long", () => {
    expect(readRoomSettings({ roomName: "x" }, "Ada").ok).toBe(false);
    expect(readRoomSettings({ roomName: "x".repeat(25) }, "Ada").ok).toBe(false);
  });
  it("rejects names that are not text", () => {
    for (const bad of [42, {}, [], true]) expect(readRoomSettings({ roomName: bad }, "Ada").ok).toBe(false);
  });
  it("rejects an unknown display", () => {
    for (const bad of ["secret", "PUBLIC", 1, {}, ""]) {
      expect(readRoomSettings({ visibility: bad }, "Ada")).toEqual({ ok: false, error: "Invalid room type" });
    }
  });
  it("keeps markup in a room name as plain text", () => {
    expect(readRoomSettings({ roomName: "<b>hi</b>" }, "Ada").name).toBe("<b>hi</b>");
  });
});

