// Socket events about chat.
import { getRoom } from "../game/room.js";
import { postMessage } from "../lib/chat.js";
import { createEventLimiter } from "../lib/rateLimit.js";
import { CHAT_MAX_MESSAGES, CHAT_WINDOW_MS } from "../config.js";

// Per player, so opening a second tab does not buy more messages.
const limiter = createEventLimiter({ limit: CHAT_MAX_MESSAGES, windowMs: CHAT_WINDOW_MS });

export function registerChatHandlers(io, socket) {
  socket.on("chat:send", (payload, ack) => {
    if (typeof ack !== "function") return;
    // Who is talking, and in which room, comes from the server, never from the client.
    const room = getRoom(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "You are not in a room" });
    const { playerId } = socket.data;

    const waitMs = limiter.retryAfterMs(playerId);
    if (waitMs > 0) {
      return ack({ ok: false, error: `You're sending messages too fast. Try again in ${Math.ceil(waitMs / 1000)}s` });
    }

    const result = postMessage(room, playerId, payload?.text);
    if (!result.ok) return ack(result);

    limiter.record(playerId); // only messages that went through use up the allowance
    ack({ ok: true });
    io.to(room.id).emit("chat:message", result.message); // everyone, including the sender
  });
}
