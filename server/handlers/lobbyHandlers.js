// The lobby screen asks to be told about public rooms, and stops when it closes.
import { listPublicRooms } from "../game/room.js";
import { LOBBY_ROOM } from "../lib/lobby.js";

export function registerLobbyHandlers(io, socket) {
  socket.on("lobby:subscribe", (ack) => {
    socket.join(LOBBY_ROOM);
    if (typeof ack === "function") ack({ ok: true, rooms: listPublicRooms() });
  });

  socket.on("lobby:unsubscribe", (ack) => {
    socket.leave(LOBBY_ROOM);
    if (typeof ack === "function") ack({ ok: true });
  });
  // No cleanup needed on disconnect: Socket.IO removes the socket from its rooms.
}
