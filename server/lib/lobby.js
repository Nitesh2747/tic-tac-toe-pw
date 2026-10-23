// The lobby: sockets on the lobby screen are in the "lobby" Socket.IO room and
// receive the list of PUBLIC rooms whenever it changes.
import { listPublicRooms } from "../game/room.js";
import { LOBBY_THROTTLE_MS } from "../config.js";

export const LOBBY_ROOM = "lobby";

let timer = null;

// Call this after anything that could change the public list. Calls made while
// an update is already waiting are folded into it, because the list is built
// when the timer fires, so it always reflects the latest state.
export function scheduleLobbyUpdate(io, waitMs = LOBBY_THROTTLE_MS) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    io.to(LOBBY_ROOM).emit("lobby:rooms", listPublicRooms());
  }, waitMs);
}
