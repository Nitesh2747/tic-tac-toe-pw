// Playing: moves, wins, draws and starting a new round.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, playMoves, seatTwoPlayers, startTestServer, waitForEvent } from "./helpers.js";

let server;
beforeEach(async () => {
    server = await startTestServer();
});
afterEach(async () => {
    await server.close();
});

const move = (socket, index) => emitAck(socket, "game:move", { index });

// Alice (X) takes the top row while Bob (O) plays elsewhere.
const aliceWins = (alice, bob) => [[alice, 0], [bob, 3], [alice, 1], [bob, 4], [alice, 2]];

describe("moves", () => {
    it("applies a move and tells both players", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const forAlice = waitForEvent(alice, "game:state");
        const forBob = waitForEvent(bob, "game:state");

        expect(await move(alice, 4)).toEqual({ ok: true });

        for (const state of [await forAlice, await forBob]) {
            expect(state.board[4]).toBe("X");
            expect(state.xIsNext).toBe(false);
        }
    });

    it("refuses a move out of turn", async () => {
        const { bob } = await seatTwoPlayers(server);
        expect(await move(bob, 0)).toEqual({ ok: false, error: "Not your turn" });
    });

    it("refuses a square that is taken", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        await move(alice, 0);
        expect(await move(bob, 0)).toEqual({ ok: false, error: "Square already taken" });
    });

    it("refuses a square that does not exist", async () => {
        const { alice } = await seatTwoPlayers(server);
        expect(await move(alice, 9)).toEqual({ ok: false, error: "Invalid square" });
    });

    it("refuses moves while waiting for an opponent", async () => {
        const alice = await server.connect();
        await emitAck(alice, "room:create", { playerId: "alice-id", name: "Alice", avatarSeed: "abcdefgh1" });
        expect(await move(alice, 0)).toEqual({ ok: false, error: "Waiting for an opponent" });
    });
});

describe("finishing a round", () => {
    it("counts a win, announces it and refuses further moves", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const finalState = waitForEvent(bob, "game:state", (state) => state.scores.X === 1);
        const announcement = waitForEvent(bob, "chat:message");

        await playMoves(aliceWins(alice, bob));

        expect((await finalState).scores).toEqual({ X: 1, O: 0, draws: 0 });
        expect(await announcement).toMatchObject({ system: true, text: "Alice won the round!" });
        expect(await move(bob, 5)).toEqual({ ok: false, error: "The game is over" });
    });

    it("counts a draw", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        const announcement = waitForEvent(bob, "chat:message");

        // X O X
        // X O O
        // O X X
        await playMoves([
            [alice, 0], [bob, 1], [alice, 2], [bob, 4], [alice, 3],
            [bob, 5], [alice, 7], [bob, 6], [alice, 8],
        ]);

        expect(await announcement).toMatchObject({ text: "The round was a draw." });
    });

    it("refuses 'play again' while the round is still going", async () => {
        const { alice } = await seatTwoPlayers(server);
        expect(await emitAck(alice, "game:reset")).toEqual({ ok: false, error: "The game is still in progress" });
    });

    it("starts the next round with the other player first, and keeps the score", async () => {
        const { alice, bob } = await seatTwoPlayers(server);
        await playMoves(aliceWins(alice, bob));

        const fresh = waitForEvent(bob, "game:state", (state) => state.board.every((cell) => cell === null));
        expect(await emitAck(alice, "game:reset")).toEqual({ ok: true });

        const state = await fresh;
        expect(state.xIsNext).toBe(false); // O (Bob) starts this round
        expect(state.scores.X).toBe(1);
    });
});