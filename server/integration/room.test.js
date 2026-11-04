// Creating and joining rooms, the way two browsers would do it.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, startTestServer, waitForEvent } from "./helpers.js";

let server;
beforeEach(async () => {
  server = await startTestServer(); // a fresh, empty server for every test
});
afterEach(async () => {
  await server.close();
});

describe("creating and joining a room", () => {
  it("seats the host as X and waits for an opponent", async () => {
    const alice = await server.connect();

    const reply = await emitAck(alice, "room:create", profile("Alice"));

    expect(reply.ok).toBe(true);
    expect(reply.role).toBe("X");
    expect(reply.code).toBeUndefined(); // only private rooms have a code
    expect(reply.state).toMatchObject({
      name: "Alice's room",
      visibility: "public",
      status: "waiting",
      hostSeat: "X",
    });
    expect(reply.state.players.X.name).toBe("Alice");
    expect(reply.state.players.O).toBeNull();
  });

  it("gives a second player seat O and tells the host", async () => {
    const alice = await server.connect();
    const bob = await server.connect();
    const created = await emitAck(alice, "room:create", profile("Alice"));

    // Start listening BEFORE Bob joins, or could miss what the server sends Alice.
    const stateForAlice = waitForEvent(alice, "game:state");
    const chatForAlice = waitForEvent(alice, "chat:message");
    const joined = await emitAck(bob, "room:join", {
      ...profile("Bob"),
      roomId: created.state.roomId,
    });

    expect(joined.ok).toBe(true);
    expect(joined.role).toBe("O");
    expect(joined.state.status).toBe("playing");
    expect((await stateForAlice).players.O.name).toBe("Bob");
    expect(await chatForAlice).toMatchObject({ system: true, text: "Bob joined." });
  });

  it("refuses a third player", async () => {
    const [alice, bob, carol] = [await server.connect(), await server.connect(), await server.connect()];
    const created = await emitAck(alice, "room:create", profile("Alice"));
    await emitAck(bob, "room:join", { ...profile("Bob"), roomId: created.state.roomId });

    const reply = await emitAck(carol, "room:join", {
      ...profile("Carol"),
      roomId: created.state.roomId,
    });

    expect(reply).toEqual({ ok: false, error: "Room is full" });
  });

  it("refuses a room that does not exist", async () => {
    const dave = await server.connect();

    const reply = await emitAck(dave, "room:join", { ...profile("Dave"), roomId: "NOSUCHROOM" });

    expect(reply).toEqual({ ok: false, error: "Room not found" });
  });
});