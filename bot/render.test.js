// The real Discord objects. discord.js checks them as they are built (label length,
// id length, five buttons per row...), so building them here catches mistakes early.
import { describe, expect, it } from "vitest";
import { COMPUTER, createGame } from "./game/game.js";
import { createChallenge } from "./game/challenge.js";
import { toChallengeMessage, toClosedMessage, toMessage } from "./render.js";

describe("toMessage", () => {
  const message = toMessage(createGame({ x: "100", o: COMPUTER, level: "easy" }));
  const rows = message.components.map((row) => row.toJSON());

  it("has the text, and never pings anyone", () => {
    expect(message.content).toContain("<@100>");
    expect(message.allowedMentions).toEqual({ parse: [] });
  });

  it("is 3 rows of 3 buttons", () => {
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.type).toBe(1); // an action row
      expect(row.components).toHaveLength(3);
      for (const button of row.components) expect(button.type).toBe(2); // a button
    }
  });

  it("gives each square its id, label, colour and state", () => {
    const first = rows[0].components[0];
    expect(first).toMatchObject({ custom_id: "ttt:move:0", label: "​", style: 2, disabled: false });
    expect(rows[2].components[2].custom_id).toBe("ttt:move:8");
  });
});

describe("challenge messages", () => {
  it("has Accept and Decline buttons and pings only the challenged player", () => {
    const message = toChallengeMessage(createChallenge({ challenger: "a", opponent: "b" }));
    const buttons = message.components[0].toJSON().components;
    expect(buttons.map((b) => b.label)).toEqual(["Accept", "Decline"]);
    expect(message.allowedMentions).toEqual({ users: ["b"] });
  });

  it("a closed message has no buttons", () => {
    expect(toClosedMessage("bye").components).toEqual([]);
  });
});
