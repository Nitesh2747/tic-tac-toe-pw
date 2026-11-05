// Abuse limits, the origin check, and a junk-input test that every event must survive.
import { afterEach, describe, expect, it, vi } from "vitest";
import { io as connectSocket } from "socket.io-client";
import { emitAck, profile, startTestServer } from "./helpers.js";

let server;
afterEach(async () => {
  await server.close();
});

describe("connection limit per address", () => {
  it("refuses a connection over the limit, and allows one again after a disconnect", async () => {
    server = await startTestServer({ MAX_CONNECTIONS_PER_IP: 3 });
    const first = await server.connect();
    await server.connect();
    await server.connect();

    await expect(server.connect()).rejects.toThrow("Too many connections");

    first.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100)); // let the server notice
    await expect(server.connect()).resolves.toBeDefined();
  });

  it("stops one machine filling the room cap (this used to work: 1000 rooms from one machine)", async () => {
    server = await startTestServer({ MAX_CONNECTIONS_PER_IP: 5, ROOM_CREATES_PER_IP: 1000 });
    let created = 0;
    for (let i = 0; i < 10; i++) {
      try {
        const socket = await server.connect();
        const reply = await emitAck(socket, "room:create", profile(`P${i}`));
        if (reply.ok) created += 1;
      } catch {
        // refused connection: exactly what we want
      }
    }
    expect(created).toBe(5);
  });
});

describe("event limit per connection", () => {
  it("refuses requests over the limit with a message", async () => {
    server = await startTestServer({ EVENT_LIMIT: 4, EVENT_WINDOW_MS: 60_000 });
    const socket = await server.connect();
    for (let i = 0; i < 4; i++) expect((await emitAck(socket, "lobby:subscribe")).rooms).toBeDefined();

    expect(await emitAck(socket, "lobby:subscribe")).toEqual({
      ok: false,
      error: "Too many requests. Slow down.",
    });
  });

  it("disconnects a connection that keeps flooding", async () => {
    server = await startTestServer({ EVENT_LIMIT: 2, EVENT_WINDOW_MS: 60_000 });
    const socket = await server.connect();
    const dropped = new Promise((resolve) => socket.once("disconnect", resolve));
    for (let i = 0; i < 20; i++) socket.emit("lobby:subscribe", () => {});
    await dropped;
    expect(socket.connected).toBe(false);
  });
});

describe("room creation limit per address", () => {
  it("refuses room creation over the limit, with the time to wait", async () => {
    server = await startTestServer({ ROOM_CREATES_PER_IP: 2 });
    for (const name of ["A1", "B2"]) {
      const socket = await server.connect();
      expect((await emitAck(socket, "room:create", profile(name))).ok).toBe(true);
    }
    const third = await server.connect();
    const reply = await emitAck(third, "room:create", profile("C3"));
    expect(reply.ok).toBe(false);
    expect(reply.error).toMatch(/creating rooms too fast/);
  });
});

describe("origin check", () => {
  // A browser always sends the Origin header, and a page cannot change it.
  const withOrigin = (origin) =>
    new Promise((resolve) => {
      const socket = connectSocket(server.url, {
        forceNew: true,
        transports: ["websocket"],
        extraHeaders: { Origin: origin },
        reconnection: false,
      });
      socket.once("connect", () => resolve({ connected: true, socket }));
      socket.once("connect_error", (error) => resolve({ connected: false, socket, error }));
    });

  it("refuses another website", async () => {
    server = await startTestServer();
    const result = await withOrigin("https://evil.example");
    expect(result.connected).toBe(false);
    result.socket.close();
  });

  it("accepts the configured website", async () => {
    server = await startTestServer({ CLIENT_ORIGIN: "https://my-app.vercel.app" });
    const result = await withOrigin("https://my-app.vercel.app");
    expect(result.connected).toBe(true);
    result.socket.close();
  });

  it("refuses an origin that only looks similar", async () => {
    server = await startTestServer({ CLIENT_ORIGIN: "https://my-app.vercel.app" });
    for (const origin of ["https://my-app.vercel.app.evil.example", "http://my-app.vercel.app", "https://my-app.vercel.app/"]) {
      const result = await withOrigin(origin);
      expect(result.connected).toBe(false);
      result.socket.close();
    }
  });
});

describe("junk input", () => {
  const EVENTS = [
    "room:create", "room:join", "room:leave", "room:kick", "game:move", "game:reset",
    "lobby:subscribe", "lobby:unsubscribe", "chat:send", "not:an:event",
  ];
  const JUNK = [
    null, undefined, 0, -1, 1.5, NaN, "", "x".repeat(3000), true, [], [1, 2], {},
    { playerId: {} },
    { playerId: "p1", name: {}, avatarSeed: [] },
    { index: {} }, { seat: {} }, { text: {} },
    { playerId: "p1", name: "Alice", avatarSeed: "abcdefgh1", roomId: {} },
    { playerId: "p1", name: "Alice", avatarSeed: "abcdefgh1", code: [] },
    { playerId: "p1", name: "Alice", avatarSeed: "abcdefgh1", visibility: {}, turnSeconds: "x" },
    JSON.parse('{"__proto__":{"polluted":true},"playerId":"p9"}'),
  ];

  it("never takes the server down, whatever a client sends", async () => {
    // Plenty of room for this test to send a lot: the limits have their own tests above.
    server = await startTestServer({ EVENT_LIMIT: 100000, ROOM_CREATES_PER_IP: 100000 });
    const crashes = [];
    const onCrash = (error) => crashes.push(String(error));
    process.on("uncaughtException", onCrash);

    const socket = await server.connect();
    await emitAck(socket, "room:create", profile("Alice")); // sit in a room, so handlers go deeper
    for (const event of EVENTS) {
      for (const payload of JUNK) {
        socket.emit(event, payload);
        socket.emit(event, payload, () => {});
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.off("uncaughtException", onCrash);

    expect(crashes).toEqual([]);
    expect(({}).polluted).toBeUndefined(); // the "__proto__" payload did not poison anything
    const another = await server.connect(); // and the server still answers new players
    expect(another.connected).toBe(true);
  }, 20_000);
});

describe("a bug inside a handler", () => {
  it("is answered politely and does not stop the server", async () => {
    // Make the game's move function throw, to stand in for any future bug.
    vi.doMock("../game/room.js", async () => ({
      ...(await vi.importActual("../game/room.js")),
      makeMove: () => {
        throw new Error("simulated bug");
      },
    }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      server = await startTestServer();
      const socket = await server.connect();
      await emitAck(socket, "room:create", profile("Alice"));

      expect(await emitAck(socket, "game:move", { index: 0 })).toEqual({ ok: false, error: "Something went wrong" });

      expect(logged).toHaveBeenCalled();
      expect(socket.connected).toBe(true);
      expect((await server.connect()).connected).toBe(true);
    } finally {
      logged.mockRestore();
      vi.doUnmock("../game/room.js");
    }
  });
});
