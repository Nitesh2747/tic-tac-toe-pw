import { describe, expect, it, vi } from "vitest";
import { IDLE_MINUTES, closeIdleGames } from "./expire.js";
import { createStore } from "../game/store.js";
import { createGame } from "../game/game.js";
import { createChallenge } from "../game/challenge.js";

function setup() {
  const clock = { time: 0 };
  const store = createStore({ idleMs: 1000, now: () => clock.time });
  const edit = vi.fn().mockResolvedValue(undefined);
  const client = { channels: { fetch: vi.fn().mockResolvedValue({ messages: { edit } }) } };
  return { clock, store, edit, client };
}

describe("closeIdleGames", () => {
  it("edits an idle game's message: keeps the text, adds why, removes the buttons", async () => {
    const { clock, store, edit, client } = setup();
    store.set("m1", createGame({ x: "a", o: "b" }), { channelId: "c1" });
    clock.time = 2000;

    await closeIdleGames(store, client);

    expect(client.channels.fetch).toHaveBeenCalledWith("c1");
    const [id, payload] = edit.mock.calls[0];
    expect(id).toBe("m1");
    expect(payload.components).toEqual([]);
    expect(payload.content).toContain("<@a>");
    expect(payload.content).toContain(`Closed after ${IDLE_MINUTES} minutes`);
    expect(store.has("m1")).toBe(false);
  });

  it("says a challenge expired", async () => {
    const { clock, store, edit, client } = setup();
    store.set("m1", createChallenge({ challenger: "a", opponent: "b" }), { channelId: "c1" });
    clock.time = 2000;
    await closeIdleGames(store, client);
    expect(edit.mock.calls[0][1].content).toBe("<@a>'s challenge to <@b> expired.");
  });

  it("leaves active games alone", async () => {
    const { store, edit, client } = setup();
    store.set("m1", createGame({ x: "a", o: "b" }), { channelId: "c1" });
    await closeIdleGames(store, client);
    expect(edit).not.toHaveBeenCalled();
    expect(store.has("m1")).toBe(true);
  });

  it("keeps going when one message cannot be edited", async () => {
    const { clock, store, edit, client } = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.set("m1", createGame({ x: "a", o: "b" }), { channelId: "c1" });
    store.set("m2", createGame({ x: "c", o: "d" }), { channelId: "c1" });
    clock.time = 2000;
    edit.mockRejectedValueOnce(new Error("Unknown Message"));

    await closeIdleGames(store, client);

    expect(edit).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
