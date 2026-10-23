import { describe, it, expect } from "vitest";
import { getAvatar } from "./avatar.js";
import { newAvatarSeed } from "./profile.js";

const filled = (avatar) => avatar.cells.flat().filter(Boolean).length;
const signature = (avatar) => `${avatar.hue}:${avatar.cells.map((row) => row.map(Number).join("")).join("/")}`;

describe("getAvatar", () => {
  it("is deterministic: the same seed always gives the same avatar", () => {
    expect(getAvatar("abcdef0123456789")).toEqual(getAvatar("abcdef0123456789"));
  });

  it("is a 5x5 grid with a hue between 0 and 359", () => {
    const { cells, hue } = getAvatar("seedseed01");
    expect(cells).toHaveLength(5);
    for (const row of cells) expect(row).toHaveLength(5);
    expect(Number.isInteger(hue)).toBe(true);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  it("is mirrored left to right", () => {
    for (let i = 0; i < 200; i++) {
      const { cells } = getAvatar(newAvatarSeed());
      for (const row of cells) {
        for (let col = 0; col < 5; col++) expect(row[col]).toBe(row[4 - col]);
      }
    }
  });

  it("is never nearly blank", () => {
    for (let i = 0; i < 2000; i++) {
      expect(filled(getAvatar(newAvatarSeed()))).toBeGreaterThanOrEqual(8);
    }
  });

  it("is never completely full either (so it still looks like a pattern)", () => {
    for (let i = 0; i < 2000; i++) {
      expect(filled(getAvatar(newAvatarSeed()))).toBeLessThan(25);
    }
  });

  it("gives different seeds different avatars", () => {
    const seen = new Set();
    for (let i = 0; i < 5000; i++) seen.add(signature(getAvatar(newAvatarSeed())));
    expect(seen.size).toBeGreaterThan(4990); // collisions are essentially impossible
  });

  it("uses the whole colour wheel", () => {
    const hues = new Set();
    for (let i = 0; i < 3000; i++) hues.add(Math.floor(getAvatar(newAvatarSeed()).hue / 30));
    expect(hues.size).toBe(12);
  });

  it("changes when the seed changes by even one character", () => {
    expect(signature(getAvatar("abcdef0123456789"))).not.toBe(signature(getAvatar("abcdef0123456788")));
  });
});
