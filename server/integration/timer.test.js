// The turn timer. TURN_SECOND_MS makes one "second" last 30 ms, so a 15 second timer runs for 450 ms and the tests stay fast.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, seatTwoPlayers, startTestServer, waitForEvent } from "./helpers.js";

const TIMER_MS = 15 * 30;

let server;
beforeEach(async () => {
    server = await startTestServer({ TURN_SECOND_MS: 30 });
});
afterEach(async () => {
    await server.close();
});

describe("the turn timer", () => {
    it("starts when both players are seated, not before", async () => {
        const { created, joined } = await seatTwoPlayers(server, { turnSeconds: 15 });

        expect(created.state.turnMsLeft).toBeNull(); // alone in the room: no clock
        expect(joined.state.turnMs).toBe(TIMER_MS);
        expect(joined.state.turnMsLeft).toBeGreaterThan(0);
        expect(joined.state.turnMsLeft).toBeLessThanOrEqual(TIMER_MS);
    });

    it("plays a random move for the player whose time ran out, and tells both", async () => {
        const { alice, bob } = await seatTwoPlayers(server, { turnSeconds: 15 });
        const timeoutForAlice = waitForEvent(alice, "game:timeout");
        const timeoutForBob = waitForEvent(bob, "game:timeout");
        const stateAfter = waitForEvent(bob, "game:state", (state) => state.board.some((cell) => cell !== null));

        const [forAlice, forBob] = [await timeoutForAlice, await timeoutForBob];

        expect(forAlice).toEqual(forBob);
        expect(forAlice.seat).toBe("X"); // it was X's turn
        const state = await stateAfter;
        expect(state.board[forAlice.index]).toBe("X");
        expect(state.xIsNext).toBe(false);
    });

    it("gives the other player a fresh clock after a move", async () => {
        const { alice, bob } = await seatTwoPlayers(server, { turnSeconds: 15 });
        const forBob = waitForEvent(bob, "game:state", (state) => state.xIsNext === false);

        await emitAck(alice, "game:move", { index: 4 });

        const state = await forBob;
        expect(state.turnMs).toBe(TIMER_MS);
        expect(state.turnMsLeft).toBeGreaterThan(0);
    });

    it("stops the clock while a player is disconnected", async () => {
        const { alice, bob } = await seatTwoPlayers(server, { turnSeconds: 15 });
        const away = waitForEvent(bob, "game:state", (state) => state.players.X.connected === false);

        alice.disconnect();

        expect((await away).turnMsLeft).toBeNull();
    });

    it("has no clock at all in a room without a timer", async () => {
        const { joined } = await seatTwoPlayers(server); // turnSeconds defaults to 0

        expect(joined.state.turnSeconds).toBe(0);
        expect(joined.state.turnMsLeft).toBeNull();
    });
});