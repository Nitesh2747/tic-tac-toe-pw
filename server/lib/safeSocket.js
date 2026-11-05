// Two protections for one connection, both applied once in app.js so the handler
// files do not need to know about them.
import { createEventLimiter } from "./rateLimit.js";

// 1. A handler that throws must never take the server down.
//    Every listener added with socket.on(...) is wrapped: if it throws (or returns a
//    rejected promise), the error is logged and the sender gets a polite refusal.
export function guardSocket(socket, log = console.error) {
  const on = socket.on.bind(socket);

  socket.on = (event, listener) =>
    on(event, (...args) => {
      const fail = (error) => {
        log(`Handler for "${event}" failed:`, error);
        const ack = args.at(-1);
        if (typeof ack === "function") {
          try {
            ack({ ok: false, error: "Something went wrong" });
          } catch {
            // the connection is already gone: nothing more to do
          }
        }
      };
      try {
        const result = listener(...args);
        if (result && typeof result.catch === "function") result.catch(fail);
      } catch (error) {
        fail(error);
      }
    });
}

// 2. One connection may only send so many events per window. Over the limit, the
//    request is answered with a refusal (if it has a callback) and never reaches the
//    handlers. A connection that keeps flooding anyway is disconnected.
export function limitSocketEvents(socket, { limit, windowMs, now }) {
  const limiter = createEventLimiter({ limit, windowMs, now });
  let refused = 0;

  socket.use((packet, next) => {
    if (limiter.retryAfterMs("events") > 0) {
      refused += 1;
      const ack = packet.at(-1);
      if (typeof ack === "function") ack({ ok: false, error: "Too many requests. Slow down." });
      if (refused > limit * 5) socket.disconnect(true);
      return; // not calling next() drops the packet
    }
    limiter.record("events");
    next();
  });
}
