// The lobby: the live list of public rooms.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, startTestServer, waitForEvent } from "./helpers.js";

let server;
let watcher;
beforeEach(async () => {
    server = await startTestServer({ LOBBY_THROTTLE_MS: 20 }); // batch updates for 20 ms, not 300
    watcher = await server.connect();
    await emitAck(watcher, "lobby:subscribe"); // someone looking at the lobby screen
});
afterEach(async () => {
    await server.close();
});

describe("the lobby list", () => {
    it("shows a new public room to people in the lobby, without any secrets", async () => {
        const alice = await server.connect();
        const update = waitForEvent(watcher, "lobby:rooms", (rooms) => rooms.length === 1);

        await emitAck(alice, "room:create", profile("Alice"));

        const [room] = await update;
        expect(room).toMatchObject({ name: "Alice's room", display: "public", players: 1, full: false });
        expect(Object.keys(room).sort()).toEqual(["display", "full", "id", "name", "players"]);
    });

    it("never shows a private room", async () => {
        const alice = await server.connect();
        const bob = await server.connect();
        await emitAck(alice, "room:create", { ...profile("Alice"), visibility: "private" });
        const update = waitForEvent(watcher, "lobby:rooms", (rooms) => rooms.length === 1);

        await emitAck(bob, "room:create", profile("Bob")); // a public one, so an update is sent

        expect((await update).map((room) => room.name)).toEqual(["Bob's room"]);
    });

    it("marks a room full once a second player joins", async () => {
        const alice = await server.connect();
        const bob = await server.connect();
        const created = await emitAck(alice, "room:create", profile("Alice"));
        const update = waitForEvent(watcher, "lobby:rooms", (rooms) => rooms[0]?.full === true);

        await emitAck(bob, "room:join", { ...profile("Bob"), roomId: created.state.roomId });

        expect((await update)[0]).toMatchObject({ players: 2, full: true });
    });

    it("removes a room when its last player leaves", async () => {
        const alice = await server.connect();
        await emitAck(alice, "room:create", profile("Alice"));
        const gone = waitForEvent(watcher, "lobby:rooms", (rooms) => rooms.length === 0);

        await emitAck(alice, "room:leave");

        expect(await gone).toEqual([]);
    });
});