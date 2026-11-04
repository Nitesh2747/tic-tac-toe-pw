// What happens to the room you are in when you try to join another one.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, seatTwoPlayers, startTestServer } from "./helpers.js";

let server;
beforeEach(async () => {
    server = await startTestServer();
});
afterEach(async () => {
    await server.close();
});

// The lobby list is the easy way to see which rooms still exist.
async function roomNames() {
    const watcher = await server.connect();
    const { rooms } = await emitAck(watcher, "lobby:subscribe");
    return rooms.map((room) => room.name).sort();
}

describe("moving between rooms", () => {
    it("takes you out of your old room when you join another open one", async () => {
        const alice = await server.connect();
        const bob = await server.connect();
        await emitAck(alice, "room:create", profile("Alice")); // Alice's room
        const bobsRoom = await emitAck(bob, "room:create", profile("Bob"));
        expect(await roomNames()).toEqual(["Alice's room", "Bob's room"]);

        const reply = await emitAck(alice, "room:join", { ...profile("Alice"), roomId: bobsRoom.state.roomId });

        expect(reply).toMatchObject({ ok: true, role: "O" });
        expect(await roomNames()).toEqual(["Bob's room"]); // Alice's empty room is gone
    });

    it("QUIRK: a refused join (room full) still takes you out of your old room", async () => {
        const carol = await server.connect();
        await emitAck(carol, "room:create", profile("Carol")); // Carol is alone in her own room
        const { roomId: fullRoomId } = await seatTwoPlayers(server); // Alice and Bob fill another
        expect(await roomNames()).toEqual(["Alice's room", "Carol's room"]);

        const reply = await emitAck(carol, "room:join", { ...profile("Carol"), roomId: fullRoomId });

        expect(reply).toEqual({ ok: false, error: "Room is full" });
        expect(await roomNames()).toEqual(["Alice's room"]); // Carol's room was deleted anyway
    });
});