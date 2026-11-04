// A tiny test that proves the helpers.js work.
import { afterEach, describe, expect, it } from "vitest";
import { emitAck, startTestServer } from "./helpers.js";

describe("test helpers", () => {
  let server;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("starts a server and talks to it", async () => {
    server = await startTestServer();
    const player = await server.connect();

    const reply = await emitAck(player, "lobby:subscribe");

    expect(reply).toEqual({ ok: true, rooms: [] });
  });

  it("gives every test its own empty server", async () => {
    server = await startTestServer();
    const alice = await server.connect();
    await emitAck(alice, "room:create", {
      playerId: "alice-id",
      name: "Alice",
      avatarSeed: "abcdefgh1",
    });
    expect((await emitAck(alice, "lobby:subscribe")).rooms).toHaveLength(1);
    await server.close();

    // A second server must not remember Alice's room.
    server = await startTestServer();
    const bob = await server.connect();
    expect((await emitAck(bob, "lobby:subscribe")).rooms).toHaveLength(0);
  });
});