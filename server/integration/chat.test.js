// Chat between the two players, and its limits.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, seatTwoPlayers, startTestServer, waitForEvent } from "./helpers.js";

const say = (socket, text) => emitAck(socket, "chat:send", { text });

describe("chat", () => {
    let server;
    beforeEach(async () => {
        server = await startTestServer();
    });
    afterEach(async () => {
        await server.close();
    });

    it("sends a cleaned-up message to both players, labelled by the server", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const forAlice = waitForEvent(alice, "chat:message");
        const forBob = waitForEvent(bob, "chat:message");

        expect(await say(alice, "  hello \n  there  ")).toEqual({ ok: true });

        for (const message of [await forAlice, await forBob]) {
            expect(message).toMatchObject({ seat: "X", name: "Alice", text: "hello there" });
        }
    });

    it("does not let a player talk to an empty room", async () => {
        const alice = await server.connect();
        await emitAck(alice, "room:create", profile("Alice"));

        expect(await say(alice, "anyone?")).toEqual({ ok: false, error: "Wait for someone to join first" });
    });

    it("refuses an empty message", async () => {
        const { alice } = await seatTwoPlayers(server);
        expect(await say(alice, "   ")).toEqual({ ok: false, error: "Type a message first" });
    });

    it("refuses a message over 200 characters, and accepts exactly 200", async () => {
        const { alice } = await seatTwoPlayers(server);

        expect(await say(alice, "a".repeat(201))).toEqual({
            ok: false,
            error: "Messages can be up to 200 characters",
        });
        expect(await say(alice, "a".repeat(200))).toEqual({ ok: true });
    });

    it("refuses something that is not text", async () => {
        const { alice } = await seatTwoPlayers(server);
        expect(await emitAck(alice, "chat:send", { text: 42 })).toEqual({ ok: false, error: "Invalid message" });
    });

    it("does not let a player who is not in a room chat", async () => {
        const stranger = await server.connect();
        expect(await say(stranger, "hi")).toEqual({ ok: false, error: "You are not in a room" });
    });
});

describe("chat: the speed limit", () => {
    let server;
    beforeEach(async () => {
        server = await startTestServer({ CHAT_MAX_MESSAGES: 2, CHAT_WINDOW_MS: 5000 });
    });
    afterEach(async () => {
        await server.close();
    });

    it("refuses messages sent too fast, and counts only the ones that went through", async () => {
        const { alice, bob } = await seatTwoPlayers(server);

        expect(await say(alice, "one")).toEqual({ ok: true });
        expect(await say(alice, "two")).toEqual({ ok: true });
        const tooFast = await say(alice, "three");

        expect(tooFast.ok).toBe(false);
        expect(tooFast.error).toMatch(/^You're sending messages too fast\. Try again in \d+s$/);
        expect(await say(bob, "my turn to talk")).toEqual({ ok: true }); // the limit is per player
    });
});