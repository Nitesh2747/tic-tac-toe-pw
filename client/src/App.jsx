import { useEffect, useState } from "react";
import { socket } from "./game/socket.js";
import { getPlayerId } from "./game/playerId.js";
import { loadProfile } from "./game/profile.js";
import { appendMessage } from "./game/chat.js";
import { useProfile } from "./hooks/useProfile.js";
import { getSavedRoom, saveRoom, clearSavedRoom } from "./game/savedRoom.js";
import ComputerSetup from "./components/ComputerSetup.jsx";
import Game from "./components/Game.jsx";
import Lobby from "./components/Lobby.jsx";
import OnlineGame from "./components/OnlineGame.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

export default function App() {
  const { profile, setProfile } = useProfile();
  const [connected, setConnected] = useState(socket.connected);
  // true if the connection has been taking a while (free hosts "sleep")
  const [slowConnect, setSlowConnect] = useState(false);
  // null while in the lobby; { role, state, code, chat } once we are inside a room
  // (code is the secret code of a private room, and undefined for a public one)
  const [session, setSession] = useState(null);
  // A message for the lobby, e.g. "you were removed from the room"
  const [notice, setNotice] = useState("");
  // true while we are trying to get back into a room after a refresh
  const [resuming, setResuming] = useState(() => Boolean(getSavedRoom()));
  // null in the lobby. Otherwise the offline game: { stage: "setup" } while choosing
  // the computer's level, or { stage: "play", mode: "two" | "computer", level }.
  const [offline, setOffline] = useState(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);

      // Runs on the first load AND after every reconnect. A reconnect gives us
      // a brand-new socket that the server knows nothing about, so we must
      // join our room again. The server recognises our playerId and gives us
      // our old seat back.
      const roomId = getSavedRoom();
      if (!roomId) {
        setResuming(false);
        return;
      }
      // Read the profile from storage, not from React state: this handler was
      // created once and would otherwise remember an old name.
      const payload = { roomId, playerId: getPlayerId(), ...loadProfile() };
      socket.emit("room:join", payload, (res) => {
        if (res.ok) {
          setSession({ role: res.role, state: res.state, code: res.code, chat: res.chat ?? [] });
        } else {
          // The room is gone (server restarted, or we timed out): back to the lobby.
          clearSavedRoom();
          setSession(null);
        }
        setResuming(false);
      });
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onGameState(state) {
      setSession((current) => (current ? { ...current, state } : current));
    }
    // Chat: one new message, or the whole chat replaced (a new person took the other
    // seat, so the old conversation is gone).
    function onChatMessage(message) {
      setSession((current) => (current ? { ...current, chat: appendMessage(current.chat, message) } : current));
    }
    function onChatHistory({ messages }) {
      setSession((current) => (current ? { ...current, chat: messages } : current));
    }
    // A private room's code was replaced (after the host removed someone).
    function onRoomCode({ code }) {
      setSession((current) => (current ? { ...current, code } : current));
    }
    // The host removed us: forget the room and say why in the lobby.
    function onKicked({ message }) {
      clearSavedRoom();
      setSession(null);
      setNotice(message);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("game:state", onGameState);
    socket.on("room:code", onRoomCode);
    socket.on("room:kicked", onKicked);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:history", onChatHistory);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("game:state", onGameState);
      socket.off("room:code", onRoomCode);
      socket.off("room:kicked", onKicked);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:history", onChatHistory);
      socket.disconnect();
    };
  }, []);

  // After a few seconds without a connection, explain why instead of leaving
  // the user staring at "Connecting…".
  useEffect(() => {
    if (connected) {
      setSlowConnect(false);
      return;
    }
    const timer = setTimeout(() => setSlowConnect(true), 4000);
    return () => clearTimeout(timer);
  }, [connected]);

  function handleEnter(newSession) {
    saveRoom(newSession.state.roomId);
    setNotice("");
    setSession({ ...newSession, chat: newSession.chat ?? [] });
    // Drop any invite ("?room=…" / "?code=…") from the address bar so it can't go stale
    // (and so a private code does not stay visible in the URL).
    window.history.replaceState(null, "", window.location.pathname);
  }

  function handleLeave() {
    // Forget the room locally first, so leaving works even while offline.
    clearSavedRoom();
    setSession(null);
    socket.emit("room:leave");
  }

  let content;
  if (session) {
    content = (
      <OnlineGame
        role={session.role}
        state={session.state}
        code={session.code}
        chat={session.chat}
        connected={connected}
        onLeave={handleLeave}
      />
    );
  } else if (offline?.stage === "setup") {
    content = (
      <ComputerSetup
        onStart={(level) => setOffline({ stage: "play", mode: "computer", level })}
        onBack={() => setOffline(null)}
      />
    );
  } else if (offline) {
    content = (
      <>
        <Game mode={offline.mode} level={offline.level} profile={profile} />
        <button type="button" className="link-button" onClick={() => setOffline(null)}>
          ← Back to lobby
        </button>
      </>
    );
  } else if (resuming) {
    content = <p className="status">Rejoining your game…</p>;
  } else {
    content = (
      <Lobby
        connected={connected}
        profile={profile}
        onSaveProfile={setProfile}
        onEnter={handleEnter}
        onPlayLocal={() => setOffline({ stage: "play", mode: "two" })}
        onPlayComputer={() => setOffline({ stage: "setup" })}
        notice={notice}
      />
    );
  }

  let connectionText = "Connected to server";
  if (!connected) {
    connectionText = slowConnect
      ? "Still connecting… the server may be waking up (this can take up to a minute)."
      : "Connecting to server…";
  }

  return (
    <main className="app">
      <ThemeToggle />
      <h1 className="title">Tic Tac Toe</h1>
      {!offline && !session && (
        <p className={`connection ${connected ? "connection--on" : ""}`}>
          {connectionText}
        </p>
      )}
      {content}
    </main>
  );
}
