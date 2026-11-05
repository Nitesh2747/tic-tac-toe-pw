import { describe, expect, it } from "vitest";
import { acceptChallenge, closeChallenge, createChallenge, describeChallenge, isOpenEntry } from "./challenge.js";
import { resign } from "./game.js";

const challenge = () => createChallenge({ challenger: "a", opponent: "b" });

describe("challenges", () => {
  it("cannot be made against yourself", () => {
    expect(() => createChallenge({ challenger: "a", opponent: "a" })).toThrow();
  });

  it("accepting starts a game: challenger is X and moves first", () => {
    const result = acceptChallenge(challenge(), "b");
    expect(result.ok).toBe(true);
    expect(result.game.players).toEqual({ X: "a", O: "b" });
    expect(result.game.xIsNext).toBe(true);
  });

  it("can only be accepted by the challenged player", () => {
    expect(acceptChallenge(challenge(), "a").ok).toBe(false);
    expect(acceptChallenge(challenge(), "stranger").ok).toBe(false);
  });

  it("can be declined by the opponent or cancelled by the challenger, not by others", () => {
    expect(closeChallenge(challenge(), "b").text).toContain("declined");
    expect(closeChallenge(challenge(), "a").text).toContain("cancelled");
    expect(closeChallenge(challenge(), "stranger")).toEqual({ ok: false, error: "This challenge isn't for you." });
  });

  it("shows both names and an Accept and a Decline button", () => {
    const { content, buttons } = describeChallenge(challenge());
    expect(content).toContain("<@a>");
    expect(content).toContain("<@b>");
    expect(buttons.map((b) => b.label)).toEqual(["Accept", "Decline"]);
  });
});

describe("isOpenEntry", () => {
  it("a waiting challenge and a running game are open; a finished round is not", () => {
    const pending = challenge();
    const game = acceptChallenge(pending, "b").game;
    expect(isOpenEntry(pending)).toBe(true);
    expect(isOpenEntry(game)).toBe(true);
    expect(isOpenEntry(resign(game, "a").game)).toBe(false);
  });
});
