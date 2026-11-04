// The host removing a player, and what that player can do afterwards.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, seatTwoPlayers, startTestServer, waitForEvent } from "./helpers.js";

let server;
beforeEach(async () => {
    server = await startTestServer();
});
afterEach(async () => {
    await server.close();
});

describe("removing a player", () => {
    it("lets the host remove the opponent, and tells everyone", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const bobIsTold = waitForEvent(bob, "room:kicked");
        const seatFreed = waitForEvent(alice, "game:state", (state) => state.players.O === null);
        const note = waitForEvent(alice, "chat:message", (message) => message.text === "Bob was removed by the host.");

        expect(await emitAck(alice, "room:kick", { seat: "O" })).toEqual({ ok: true });

        expect(await bobIsTold).toEqual({ message: "You were removed from the room by the host." });
        expect((await seatFreed).status).toBe("waiting");
        expect(await note).toMatchObject({ system: true });
    });

    it("refuses a kick from someone who is not the host", async () => {
        const { bob } = await seatTwoPlayers(server);
        expect(await emitAck(bob, "room:kick", { seat: "X" })).toEqual({
            ok: false,
            error: "Only the host can remove players",
        });
    });

    it("does not let the host remove themselves", async () => {
        const { alice } = await seatTwoPlayers(server);
        expect(await emitAck(alice, "room:kick", { seat: "X" })).toEqual({
            ok: false,
            error: "You cannot remove yourself",
        });
    });

    it("does not let a removed player back into the room", async () => {
        const { alice, roomId } = await seatTwoPlayers(server);
        await emitAck(alice, "room:kick", { seat: "O" });

        const newBob = await server.connect();
        const reply = await emitAck(newBob, "room:join", { ...profile("Bob"), roomId });

        expect(reply).toEqual({ ok: false, error: "You were removed from this room" });
    });

    // KNOWN LIMIT (README, "Removal can be dodged"): the ban is on the playerId, and a
    // browser can get a new one by clearing its storage. This test records today's
    // behaviour. When the limit is fixed, this is the test to change.
    it("can be dodged today by coming back with a new player id", async () => {
        const { alice, roomId } = await seatTwoPlayers(server);
        await emitAck(alice, "room:kick", { seat: "O" });

        const sameBobNewId = await server.connect();
        const reply = await emitAck(sameBobNewId, "room:join", {
            ...profile("Bob"),
            playerId: "bob-with-cleared-storage",
            roomId,
        });

        expect(reply).toMatchObject({ ok: true, role: "O" });
    });

    it("replaces a private room's code, so the old one stops working", async () => {
        const { alice, code: oldCode } = await seatTwoPlayers(server, { visibility: "private" });
        const newCodeSent = waitForEvent(alice, "room:code");

        await emitAck(alice, "room:kick", { seat: "O" });

        const { code: newCode } = await newCodeSent;
        expect(newCode).not.toBe(oldCode);

        const carol = await server.connect();
        expect(await emitAck(carol, "room:join", { ...profile("Carol"), code: oldCode })).toEqual({
            ok: false,
            error: "No room found for that code",
        });
        expect(await emitAck(carol, "room:join", { ...profile("Carol"), code: newCode })).toMatchObject({ ok: true });
    });
});