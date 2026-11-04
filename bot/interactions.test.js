import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { handleInteraction, parseMoveId } from "./interactions.js";

// A fake interaction: just the few things handleInteraction touches.
function fakeCommand({ userId = "u1", subcommand = "computer", level = null, opponent = { id: "u2", bot: false } } = {}) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName: "ttt",
    user: { id: userId },
    options: {
      getSubcommand: () => subcommand,
      getString: () => level,
      getUser: () => opponent,
    },
    reply: vi.fn().mockResolvedValue(undefined),
    fetchReply: vi.fn().mockResolvedValue({ id: "msg1" }),
  };
}
function fakeClick({ userId = "u1", messageId = "msg1", customId }) {
  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    customId,
    user: { id: userId },
    message: { id: messageId },
    reply: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}
const marks = (game, mark) => game.board.filter((cell) => cell === mark).length;

describe("parseMoveId", () => {
  it("reads a valid square", () => {
    expect(parseMoveId("ttt:move:0")).toBe(0);
    expect(parseMoveId("ttt:move:8")).toBe(8);
  });
  it("rejects anything else", () => {
    for (const bad of ["ttt:move:9", "ttt:move:-1", "ttt:move:1x", "ttt:move:", "ttt:move:01", "other:3", "", null, undefined, 4]) {
      expect(parseMoveId(bad)).toBeNull();
    }
  });
});

describe("/ttt computer", () => {
  let games;
  beforeEach(() => {
    games = new Map();
  });

  it("posts a board and remembers the game under the message id", async () => {
    const command = fakeCommand();
    await handleInteraction(command, games);
    expect(command.reply).toHaveBeenCalledOnce();
    expect(games.get("msg1")).toMatchObject({ players: { X: "u1", O: "computer" }, level: "medium" });
  });

  it("uses the chosen level", async () => {
    await handleInteraction(fakeCommand({ level: "hard" }), games);
    expect(games.get("msg1").level).toBe("hard");
  });

  it("ignores other commands", async () => {
    const command = { ...fakeCommand(), commandName: "other" };
    await handleInteraction(command, games);
    expect(command.reply).not.toHaveBeenCalled();
  });
});

describe("clicking a square", () => {
  let games;
  beforeEach(async () => {
    games = new Map();
    await handleInteraction(fakeCommand(), games);
  });

  it("plays the move, the computer answers, and the board message is updated", async () => {
    const click = fakeClick({ customId: "ttt:move:4" });
    await handleInteraction(click, games);

    expect(click.update).toHaveBeenCalledOnce();
    expect(click.reply).not.toHaveBeenCalled();
    const game = games.get("msg1");
    expect(game.board[4]).toBe("X");
    expect(marks(game, "X")).toBe(1);
    expect(marks(game, "O")).toBe(1); // the computer replied (where is random, so count)
  });

  it("refuses a click from someone who is not playing, privately, and changes nothing", async () => {
    const before = games.get("msg1");
    const click = fakeClick({ userId: "stranger", customId: "ttt:move:4" });
    await handleInteraction(click, games);

    expect(click.update).not.toHaveBeenCalled();
    expect(click.reply).toHaveBeenCalledWith({
      content: "You're not playing in this game.",
      flags: MessageFlags.Ephemeral,
    });
    expect(games.get("msg1")).toBe(before);
  });

  it("refuses a taken square", async () => {
    await handleInteraction(fakeClick({ customId: "ttt:move:4" }), games);
    const before = games.get("msg1");
    const click = fakeClick({ customId: "ttt:move:4" });
    await handleInteraction(click, games);

    expect(click.reply).toHaveBeenCalledWith({ content: "That square is taken.", flags: MessageFlags.Ephemeral });
    expect(games.get("msg1")).toBe(before);
  });

  it("says so when the game is not known (for example after a restart)", async () => {
    const click = fakeClick({ messageId: "unknown", customId: "ttt:move:0" });
    await handleInteraction(click, games);
    expect(click.update).not.toHaveBeenCalled();
    expect(click.reply).toHaveBeenCalledWith({
      content: "This game isn't active any more. Start a new one with /ttt.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("ignores buttons that are not board squares", async () => {
    const click = fakeClick({ customId: "something:else" });
    await handleInteraction(click, games);
    expect(click.update).not.toHaveBeenCalled();
    expect(click.reply).not.toHaveBeenCalled();
  });

  it("plays a full game to a result without errors", async () => {
    for (let i = 0; i < 9; i++) {
      const game = games.get("msg1");
      const free = game.board.findIndex((cell) => cell === null);
      if (game.board.every((c) => c !== null)) break;
      const click = fakeClick({ customId: `ttt:move:${free}` });
      await handleInteraction(click, games);
      if (click.reply.mock.calls.length) break; // game over: further clicks are refused
    }
    const final = games.get("msg1");
    const over = final.board.every((c) => c !== null) || final.board.some((c, i) => c && [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some((l) => l.includes(i) && l.every((j) => final.board[j] === c)));
    expect(over).toBe(true);
  });

  it("logs instead of crashing when Discord fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const click = fakeClick({ customId: "ttt:move:4" });
    click.update.mockRejectedValue(new Error("boom"));
    await expect(handleInteraction(click, games)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("/ttt challenge", () => {
  let games;
  beforeEach(() => {
    games = new Map();
  });
  const challenge = (options) => fakeCommand({ subcommand: "challenge", ...options });

  it("posts a challenge and remembers it as pending", async () => {
    const command = challenge();
    await handleInteraction(command, games);
    expect(command.reply).toHaveBeenCalledOnce();
    expect(games.get("msg1")).toEqual({ pending: true, challenger: "u1", opponent: "u2" });
  });

  it("refuses to challenge yourself or a bot, privately, and stores nothing", async () => {
    const self = challenge({ opponent: { id: "u1", bot: false } });
    await handleInteraction(self, games);
    expect(self.reply.mock.calls[0][0].flags).toBe(MessageFlags.Ephemeral);

    const bot = challenge({ opponent: { id: "b1", bot: true } });
    await handleInteraction(bot, games);
    expect(bot.reply.mock.calls[0][0].flags).toBe(MessageFlags.Ephemeral);
    expect(games.size).toBe(0);
  });
});

describe("answering a challenge", () => {
  let games;
  beforeEach(async () => {
    games = new Map();
    await handleInteraction(fakeCommand({ subcommand: "challenge" }), games); // u1 challenges u2
  });

  it("accepting turns it into a game and updates the message", async () => {
    const click = fakeClick({ userId: "u2", customId: "ttt:accept" });
    await handleInteraction(click, games);
    expect(click.update).toHaveBeenCalledOnce();
    expect(games.get("msg1")).toMatchObject({ players: { X: "u1", O: "u2" } });
  });

  it("only the challenged player can accept", async () => {
    for (const userId of ["u1", "stranger"]) {
      const click = fakeClick({ userId, customId: "ttt:accept" });
      await handleInteraction(click, games);
      expect(click.update).not.toHaveBeenCalled();
      expect(click.reply.mock.calls[0][0].flags).toBe(MessageFlags.Ephemeral);
    }
    expect(games.get("msg1").pending).toBe(true);
  });

  it("declining or cancelling ends it and removes the buttons", async () => {
    const click = fakeClick({ userId: "u2", customId: "ttt:decline" });
    await handleInteraction(click, games);
    expect(click.update.mock.calls[0][0].components).toEqual([]);
    expect(games.has("msg1")).toBe(false);
  });

  it("a stranger cannot decline for them", async () => {
    const click = fakeClick({ userId: "stranger", customId: "ttt:decline" });
    await handleInteraction(click, games);
    expect(click.update).not.toHaveBeenCalled();
    expect(games.has("msg1")).toBe(true);
  });

  it("a second accept click finds nothing pending", async () => {
    await handleInteraction(fakeClick({ userId: "u2", customId: "ttt:accept" }), games);
    const again = fakeClick({ userId: "u2", customId: "ttt:accept" });
    await handleInteraction(again, games);
    expect(again.reply.mock.calls[0][0].content).toBe("This challenge isn't active any more.");
  });
});

describe("a game between two people", () => {
  it("only the player whose turn it is can move, and turns alternate", async () => {
    const games = new Map();
    await handleInteraction(fakeCommand({ subcommand: "challenge" }), games);
    await handleInteraction(fakeClick({ userId: "u2", customId: "ttt:accept" }), games);

    const wrongTurn = fakeClick({ userId: "u2", customId: "ttt:move:0" }); // X (u1) starts
    await handleInteraction(wrongTurn, games);
    expect(wrongTurn.reply.mock.calls[0][0].content).toBe("It's not your turn.");

    await handleInteraction(fakeClick({ userId: "u1", customId: "ttt:move:0" }), games);
    await handleInteraction(fakeClick({ userId: "u2", customId: "ttt:move:4" }), games);
    const game = games.get("msg1");
    expect(game.board[0]).toBe("X");
    expect(game.board[4]).toBe("O");
  });

  it("a stray move click on a pending challenge is refused", async () => {
    const games = new Map();
    await handleInteraction(fakeCommand({ subcommand: "challenge" }), games);
    const click = fakeClick({ userId: "u2", customId: "ttt:move:0" });
    await handleInteraction(click, games);
    expect(click.reply.mock.calls[0][0].content).toBe("This challenge hasn't been accepted yet.");
  });
});
