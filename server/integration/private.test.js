// Private rooms: codes, and the limits on guessing them.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, profile, startTestServer } from "./helpers.js";

async function createPrivateRoom(socket, name = "Alice") {
    return emitAck(socket, "room:create", { ...profile(name), visibility: "private" });
}

describe("private rooms", () => {
    let server;
    beforeEach(async () => {
        server = await startTestServer();
    });
    afterEach(async () => {
        await server.close();
    });

    it("gives the host a code, keeps it out of the public state, and does not list the room", async () => {
        const alice = await server.connect();
        const created = await createPrivateRoom(alice);

        expect(created.code).toMatch(/^[A-Z0-9]{6}$/);
        expect(created.state.visibility).toBe("private");
        expect(JSON.stringify(created.state)).not.toContain(created.code);

        const watcher = await server.connect();
        expect((await emitAck(watcher, "lobby:subscribe")).rooms).toEqual([]);
    });

    it("lets a player in with the code, however they type it", async () => {
        const alice = await server.connect();
        const bob = await server.connect();
        const { code } = await createPrivateRoom(alice);

        const messy = ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3).toLowerCase()} `;
        const reply = await emitAck(bob, "room:join", { ...profile("Bob"), code: messy });

        expect(reply).toMatchObject({ ok: true, role: "O" });
        expect(reply.code).toBe(code); // players inside get the code too
    });

    it("does not let anyone in by room id alone", async () => {
        const alice = await server.connect();
        const bob = await server.connect();
        const created = await createPrivateRoom(alice);

        const reply = await emitAck(bob, "room:join", { ...profile("Bob"), roomId: created.state.roomId });

        expect(reply).toEqual({ ok: false, error: "Room not found" });
    });

    it("blocks a connection after too many wrong codes, even for the right one", async () => {
        const alice = await server.connect();
        const guesser = await server.connect();
        const { code } = await createPrivateRoom(alice);

        for (let i = 0; i < 5; i++) {
            const reply = await emitAck(guesser, "room:join", { ...profile("Eve"), code: "AAAAAA" });
            expect(reply).toEqual({ ok: false, error: "No room found for that code" });
        }
        const blocked = await emitAck(guesser, "room:join", { ...profile("Eve"), code });

        expect(blocked.ok).toBe(false);
        expect(blocked.error).toMatch(/^Too many attempts\. Try again in \d+ seconds$/);
    });
});

describe("private rooms: the limit per IP address", () => {
    let server;
    beforeEach(async () => {
        // Every test player connects from the same address, so a tiny limit is easy to reach.
        server = await startTestServer({ CODE_FAILS_PER_IP: 3, CODE_FAILS_PER_SOCKET: 100 });
    });
    afterEach(async () => {
        await server.close();
    });

    it("blocks a new connection from an address that has guessed wrong too often", async () => {
        const alice = await server.connect();
        const { code } = await createPrivateRoom(alice);

        for (let i = 0; i < 3; i++) {
            const guesser = await server.connect(); // a new connection each time...
            await emitAck(guesser, "room:join", { ...profile("Eve"), code: "AAAAAA" });
        }
        const fresh = await server.connect(); // ...so only the address links them
        const blocked = await emitAck(fresh, "room:join", { ...profile("Eve"), code });

        expect(blocked.error).toMatch(/^Too many attempts/);
    });
});