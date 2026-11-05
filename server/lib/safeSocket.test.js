import { describe, expect, it, vi } from "vitest";
import { guardSocket, limitSocketEvents } from "./safeSocket.js";

// The smallest fake of a socket: on(), use() and disconnect().
function fakeSocket() {
  const listeners = {};
  const middlewares = [];
  return {
    listeners,
    on(event, listener) {
      listeners[event] = listener;
    },
    use(fn) {
      middlewares.push(fn);
    },
    disconnect: vi.fn(),
    // Sends a packet through the middlewares and then the listener, like Socket.IO does.
    send(event, ...args) {
      let delivered = false;
      const run = (index) => {
        if (index === middlewares.length) {
          delivered = true;
          return listeners[event]?.(...args);
        }
        middlewares[index]([event, ...args], () => run(index + 1));
      };
      run(0);
      return delivered;
    },
  };
}

describe("guardSocket", () => {
  it("catches a handler that throws and answers the sender", () => {
    const socket = fakeSocket();
    const log = vi.fn();
    guardSocket(socket, log);
    socket.on("boom", () => {
      throw new Error("bug");
    });
    const ack = vi.fn();

    expect(() => socket.listeners.boom({}, ack)).not.toThrow();

    expect(ack).toHaveBeenCalledWith({ ok: false, error: "Something went wrong" });
    expect(log).toHaveBeenCalledOnce();
  });

  it("catches a rejected promise too", async () => {
    const socket = fakeSocket();
    const log = vi.fn();
    guardSocket(socket, log);
    socket.on("later", async () => {
      throw new Error("async bug");
    });
    const ack = vi.fn();

    socket.listeners.later({}, ack);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ack).toHaveBeenCalledWith({ ok: false, error: "Something went wrong" });
  });

  it("does not interfere with a handler that works", () => {
    const socket = fakeSocket();
    guardSocket(socket, vi.fn());
    const handler = vi.fn(() => "fine");
    socket.on("ok", handler);
    socket.listeners.ok("a", "b");
    expect(handler).toHaveBeenCalledWith("a", "b");
  });

  it("copes with an event that has no callback", () => {
    const socket = fakeSocket();
    guardSocket(socket, vi.fn());
    socket.on("boom", () => {
      throw new Error("bug");
    });
    expect(() => socket.listeners.boom({})).not.toThrow();
  });
});

describe("limitSocketEvents", () => {
  const setup = () => {
    const clock = { time: 0 };
    const socket = fakeSocket();
    limitSocketEvents(socket, { limit: 3, windowMs: 1000, now: () => clock.time });
    socket.on("ping", () => {});
    return { socket, clock };
  };

  it("lets events through up to the limit, then refuses with a message", () => {
    const { socket } = setup();
    for (let i = 0; i < 3; i++) expect(socket.send("ping", vi.fn())).toBe(true);

    const ack = vi.fn();
    expect(socket.send("ping", ack)).toBe(false);
    expect(ack).toHaveBeenCalledWith({ ok: false, error: "Too many requests. Slow down." });
  });

  it("allows events again once the window has passed", () => {
    const { socket, clock } = setup();
    for (let i = 0; i < 3; i++) socket.send("ping", vi.fn());
    clock.time = 1001;
    expect(socket.send("ping", vi.fn())).toBe(true);
  });

  it("drops a connection that keeps flooding", () => {
    const { socket } = setup();
    for (let i = 0; i < 3; i++) socket.send("ping", vi.fn()); // the allowance
    for (let i = 0; i < 15; i++) socket.send("ping", vi.fn()); // refused, but not yet dropped
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.send("ping", vi.fn()); // one over limit * 5
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
