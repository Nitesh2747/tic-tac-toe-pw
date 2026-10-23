// Socket events about playing: moves and starting a new round.
import { getRoom, makeMove, resetGame, getPublicState } from "../game/room.js";

export function registerGameHandlers(io, socket) {
  socket.on("game:move", (payload, ack) => {
    if (typeof ack !== "function") return;
    // Who is playing and in which room comes from the server, never from the client.
    const room = getRoom(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "You are not in a room" });

    const result = makeMove(room, socket.data.playerId, payload?.index);
    if (!result.ok) return ack(result);

    ack({ ok: true });
    io.to(room.id).emit("game:state", getPublicState(room)); // everyone, including the mover
  });

  socket.on("game:reset", (ack) => {
    if (typeof ack !== "function") return;
    const room = getRoom(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "You are not in a room" });

    const result = resetGame(room, socket.data.playerId);
    if (!result.ok) return ack(result);

    ack({ ok: true });
    io.to(room.id).emit("game:state", getPublicState(room));
  });
}
