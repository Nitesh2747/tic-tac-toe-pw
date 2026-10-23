import { useEffect, useState } from "react";
import { socket } from "../game/socket.js";

// The live list of PUBLIC rooms, or null until the first list arrives (or while
// offline). The server pushes a fresh list whenever it changes.
export function useLobbyRooms(connected) {
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    if (!connected) {
      setRooms(null);
      return;
    }
    function onRooms(list) {
      setRooms(list);
    }
    socket.on("lobby:rooms", onRooms);
    socket.emit("lobby:subscribe", (res) => {
      if (res?.ok) setRooms(res.rooms);
    });
    return () => {
      socket.off("lobby:rooms", onRooms);
      socket.emit("lobby:unsubscribe");
    };
  }, [connected]);

  return rooms;
}
