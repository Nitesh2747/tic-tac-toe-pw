// Refreshing, dropping and coming back, and the reconnect grace period.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, seatTwoPlayers, startTestServer, waitForEvent } from "./helpers.js";

describe("coming back", () => {
    let server;
    beforeEach(async () => {
        server = await startTestServer();
    });
    afterEach(async () => {
        await server.close();
    });

    it("gives a refreshed player the same seat, with the board as it was", async () => {
        const { alice, bob, roomId } = await seatTwoPlayers(server);
        await emitAck(alice, "game:move", { index: 4 });

        const away = waitForEvent(bob, "game:state", (state) => state.players.X.connected === false);
        alice.disconnect(); // the page was refreshed: the old connection is gone
        await away;

        const back = waitForEvent(bob, "game:state", (state) => state.players.X.connected === true);
        const newAlice = await server.connect(); // a brand-new connection, same playerId
        const rejoined = await emitAck(newAlice, "room:join", { ...profile("Alice"), roomId });

        expect(rejoined).toMatchObject({ ok: true, role: "X" });
        expect(rejoined.state.board[4]).toBe("X");
        await back; // Bob is told she is online again
    });

    it("does not announce a refresh as a new person joining", async () => {
        const { alice, bob, roomId } = await seatTwoPlayers(server);
        const away = waitForEvent(bob, "game:state", (state) => state.players.X.connected === false);
        alice.disconnect();
        await away;

        const messages = [];
        bob.on("chat:message", (message) => messages.push(message));
        const back = waitForEvent(bob, "game:state", (state) => state.players.X.connected === true);
        const newAlice = await server.connect();
        await emitAck(newAlice, "room:join", { ...profile("Alice"), roomId });
        await back;

        expect(messages).toEqual([]);
    });

    it("pauses the game while a player is away", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const away = waitForEvent(bob, "game:state", (state) => state.players.X.connected === false);
        alice.disconnect();
        await away;

        expect(await emitAck(bob, "game:move", { index: 0 })).toEqual({ ok: false, error: "Opponent disconnected" });
    });

    it("sends the chat history to a player who comes back", async () => {
        const { alice, roomId } = await seatTwoPlayers(server);
        await emitAck(alice, "chat:send", { text: "hello" });
        alice.disconnect();

        const newAlice = await server.connect();
        const rejoined = await emitAck(newAlice, "room:join", { ...profile("Alice"), roomId });

        expect(rejoined.chat.map((message) => message.text)).toContain("hello");
    });
});

describe("the reconnect grace period", () => {
    let server;
    beforeEach(async () => {
        server = await startTestServer({ RECONNECT_GRACE_MS: 200 }); // 200 ms instead of a minute
    });
    afterEach(async () => {
        await server.close();
    });

    it("frees the seat, hands over hosting and says so when the player does not return", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const seatFreed = waitForEvent(bob, "game:state", (state) => state.players.X === null);
        const note = waitForEvent(bob, "chat:message", (message) => message.text === "Alice left.");

        alice.disconnect();

        const state = await seatFreed;
        expect(state.status).toBe("waiting");
        expect(state.hostSeat).toBe("O"); // Bob is the host now
        expect(await note).toMatchObject({ system: true });
    });

    it("keeps the seat for a player who returns within the grace period", async () => {
        const { alice, roomId } = await seatTwoPlayers(server);
        alice.disconnect();

        const newAlice = await server.connect();
        const rejoined = await emitAck(newAlice, "room:join", { ...profile("Alice"), roomId });
        await new Promise((resolve) => setTimeout(resolve, 300)); // longer than the grace period

        expect(rejoined).toMatchObject({ ok: true, role: "X" });
        // Still seated: a move is accepted (it would say "not in this room" otherwise).
        expect(await emitAck(newAlice, "game:move", { index: 0 })).toEqual({ ok: true });
    });
});