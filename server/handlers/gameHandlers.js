// Socket events about playing: moves and starting a new round.
import { getRoom, makeMove, resetGame, getPublicState } from "../game/room.js";
import { syncTurnTimer } from "../lib/turnTimer.js";
import { announceResult } from "../lib/chat.js";

export function registerGameHandlers(io, socket) {
  socket.on("game:move", (payload, ack) => {
    if (typeof ack !== "function") return;
    // Who is playing and in which room comes from the server, never from the client.
    const room = getRoom(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "You are not in a room" });

    const result = makeMove(room, socket.data.playerId, payload?.index);
    if (!result.ok) return ack(result);

    ack({ ok: true });
    syncTurnTimer(io, room); // a fresh clock for the other player (or none if the game ended)
    io.to(room.id).emit("game:state", getPublicState(room)); // everyone, including the mover
    announceResult(io, room); // if that move ended the round, say so in the chat
  });

  socket.on("game:reset", (ack) => {
    if (typeof ack !== "function") return;
    const room = getRoom(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "You are not in a room" });

    const result = resetGame(room, socket.data.playerId);
    if (!result.ok) return ack(result);

    ack({ ok: true });
    syncTurnTimer(io, room); // a new round: the clock starts again
    io.to(room.id).emit("game:state", getPublicState(room));
  });
}
