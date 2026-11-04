import { vi } from "vitest";
import { io as connectSocket } from "socket.io-client";

const WAIT_MS = 1000; // how long a test waits for the server before giving up

export async function startTestServer(env = {}) {
    // 1. Set the environment for this server, remembering what was there before.
    const before = {};
    for (const [key, value] of Object.entries(env)) {
        before[key] = process.env[key];
        process.env[key] = String(value);
    }

    vi.resetModules();
    const { createApp } = await import("../app.js");
    const { httpServer, io } = createApp();
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const url = `http://localhost:${httpServer.address().port}`;

    const clients = [];

    async function connect() {
        const socket = await connectClient(url);
        clients.push(socket);
        return socket;
    }

    async function close() {
        for (const socket of clients) socket.disconnect();
        await new Promise((resolve) => io.close(resolve));
        // Put the environment back the way we found it.
        for (const [key, value] of Object.entries(before)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }

    return { url, connect, close };
}

function connectClient(url) {
    const socket = connectSocket(url, { forceNew: true, transports: ["websocket"] });
    return new Promise((resolve, reject) => {
        socket.once("connect", () => resolve(socket));
        socket.once("connect_error", reject);
    });
}

export function emitAck(socket, event, ...args) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No reply to "${event}"`)), WAIT_MS);
        socket.emit(event, ...args, (reply) => {
            clearTimeout(timer);
            resolve(reply);
        });
    });
}

export function waitForEvent(socket, event, matches = () => true) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, onEvent);
            reject(new Error(`Waited ${WAIT_MS} ms for "${event}"`));
        }, WAIT_MS);
        function onEvent(payload) {
            if (!matches(payload)) return;
            clearTimeout(timer);
            socket.off(event, onEvent);
            resolve(payload);
        }
        socket.on(event, onEvent);
    });
}

export function profile(name) {
    return { playerId: `${name}-id`, name, avatarSeed: "abcdefgh1" };
}

export async function seatTwoPlayers(server, roomOptions = {}) {
    const alice = await server.connect();
    const bob = await server.connect();
    const created = await emitAck(alice, "room:create", { ...profile("Alice"), ...roomOptions });
    const roomId = created.state.roomId;

    const aliceHears = Promise.all([
        waitForEvent(alice, "game:state"),
        waitForEvent(alice, "chat:message"),
    ]);
    // A private room is joined with its code, a public one by its id.
    const target = created.code ? { code: created.code } : { roomId };
    const joined = await emitAck(bob, "room:join", { ...profile("Bob"), ...target });
    await aliceHears;

    return { alice, bob, created, joined, roomId, code: created.code };
}

// Plays moves in order. Each entry is [player's socket, square]; every move must be accepted.
export async function playMoves(moves) {
    for (const [socket, index] of moves) {
        const reply = await emitAck(socket, "game:move", { index });
        if (!reply.ok) throw new Error(`Move ${index} was refused: ${reply.error}`);
    }
}