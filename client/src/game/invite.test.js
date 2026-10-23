import { describe, it, expect } from "vitest";
import { CODE_LENGTH, normalizeCode, parseInvite, buildInviteLink } from "./invite.js";

describe("normalizeCode", () => {
  it("uppercases and drops spaces and dashes", () => {
    expect(normalizeCode(" ab-c 123 ")).toBe("ABC123");
  });
  it("never returns more than 6 characters", () => {
    expect(normalizeCode("abcdefghij")).toHaveLength(CODE_LENGTH);
  });
  it("copes with odd input", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeCode(123456)).toBe("123456");
  });
});

describe("parseInvite", () => {
  it("reads a private-room link", () => {
    expect(parseInvite("?code=ABC123")).toEqual({ code: "ABC123" });
    expect(parseInvite("?code=abc-123")).toEqual({ code: "ABC123" });
  });
  it("reads a public-room link", () => {
    expect(parseInvite("?room=K4M9PQ2XTR")).toEqual({ roomId: "K4M9PQ2XTR" });
  });
  it("prefers the code when a link has both", () => {
    expect(parseInvite("?room=K4M9PQ2XTR&code=ABC123")).toEqual({ code: "ABC123" });
  });
  it("ignores links that are not invites", () => {
    for (const search of ["", "?", "?code=ABC", "?code=", "?room=", "?room=abc", "?room=has space!!", "?other=1"]) {
      expect(parseInvite(search)).toBeNull();
    }
  });
  it("ignores markup and absurdly long values", () => {
    expect(parseInvite("?room=<script>alert(1)</script>")).toBeNull();
    expect(parseInvite(`?room=${"A".repeat(200)}`)).toBeNull();
  });
});

describe("buildInviteLink", () => {
  it("a public room's link carries the id", () => {
    expect(buildInviteLink("http://192.168.1.5:5173", { visibility: "public", roomId: "K4M9PQ2XTR", code: undefined }))
      .toBe("http://192.168.1.5:5173/?room=K4M9PQ2XTR");
  });
  it("a private room's link carries the code, never the room id", () => {
    const link = buildInviteLink("https://x.app", { visibility: "private", roomId: "K4M9PQ2XTR", code: "ABC123" });
    expect(link).toBe("https://x.app/?code=ABC123");
    expect(link).not.toContain("K4M9PQ2XTR");
  });
  it("links round-trip through parseInvite", () => {
    const pub = buildInviteLink("https://x.app", { visibility: "public", roomId: "K4M9PQ2XTR" });
    const priv = buildInviteLink("https://x.app", { visibility: "private", roomId: "K4M9PQ2XTR", code: "ABC123" });
    expect(parseInvite(new URL(pub).search)).toEqual({ roomId: "K4M9PQ2XTR" });
    expect(parseInvite(new URL(priv).search)).toEqual({ code: "ABC123" });
  });
});
