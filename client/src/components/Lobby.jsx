import { useEffect, useRef, useState } from "react";
import { socket } from "../game/socket.js";
import { getPlayerId } from "../game/playerId.js";
import { getLastRoom } from "../game/savedRoom.js";
import { normalizeCode, parseInvite, CODE_LENGTH } from "../game/invite.js";
import { useLobbyRooms } from "../hooks/useLobbyRooms.js";
import Avatar from "./Avatar.jsx";
import ProfileForm from "./ProfileForm.jsx";
import CreateRoomForm from "./CreateRoomForm.jsx";
import RoomList from "./RoomList.jsx";

export default function Lobby({ connected, profile, onSaveProfile, onEnter, onPlayLocal, notice }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false); // changing name / avatar
  const [creating, setCreating] = useState(false); // the "create a room" form is open
  const [pending, setPending] = useState(false); // waiting for the server to answer
  const rooms = useLobbyRooms(connected && Boolean(profile) && !editing);
  const triedInvite = useRef(false);

  // Everything the server needs to seat us: who we are (secret) and how we look (public).
  function identity() {
    return { playerId: getPlayerId(), name: profile.name, avatarSeed: profile.avatarSeed };
  }

  // The server answers with { ok, role, state, code? } or { ok: false, error }.
  function handleResponse(res) {
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onEnter({ role: res.role, state: res.state, code: res.code });
  }

  function send(event, payload) {
    setError("");
    setPending(true);
    socket.emit(event, { ...identity(), ...payload }, handleResponse);
  }

  // An invite link joins its room directly, once we know who the player is.
  useEffect(() => {
    if (triedInvite.current || !connected || !profile) return;
    const invite = parseInvite(window.location.search);
    if (!invite) return;
    triedInvite.current = true;
    setPending(true);
    socket.emit("room:join", { ...identity(), ...invite }, (res) => {
      // The link has been used, whatever happened: never try it again.
      window.history.replaceState(null, "", window.location.pathname);
      handleResponse(res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, profile]);

  // First visit, or "Change" was pressed: pick a name before anything else.
  if (!profile || editing) {
    return (
      <section className="lobby">
        <ProfileForm
          initial={profile}
          onSave={(next) => {
            onSaveProfile(next);
            setEditing(false);
          }}
          onCancel={profile ? () => setEditing(false) : undefined}
        />
        <button type="button" className="link-button" onClick={onPlayLocal}>
          Play on this device instead
        </button>
      </section>
    );
  }

  if (creating) {
    return (
      <section className="lobby">
        <CreateRoomForm
          profile={profile}
          busy={pending || !connected}
          error={error}
          onCreate={(settings) => send("room:create", settings)}
          onCancel={() => {
            setCreating(false);
            setError("");
          }}
        />
      </section>
    );
  }

  return (
    <section className="lobby">
      <p className="lobby__who">
        <Avatar seed={profile.avatarSeed} size={28} />
        <span className="lobby__who-text">
          Playing as <strong>{profile.name}</strong>
        </span>
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          Change
        </button>
      </p>

      {notice && (
        <p className="lobby__notice" role="status">
          {notice}
        </p>
      )}

      <button
        type="button"
        className="reset reset--highlight"
        onClick={() => {
          setError("");
          setCreating(true);
        }}
        disabled={!connected || pending}
      >
        Create a room
      </button>

      <div className="lobby__section">
        <h2 className="lobby__heading">Public rooms</h2>
        <RoomList
          rooms={rooms}
          onJoin={(roomId) => send("room:join", { roomId })}
          disabled={!connected || pending}
          rejoinId={getLastRoom()}
        />
      </div>

      <form
        className="lobby__join"
        onSubmit={(event) => {
          event.preventDefault();
          send("room:join", { code });
        }}
      >
        <label htmlFor="room-code" className="visually-hidden">
          Private room code
        </label>
        <input
          id="room-code"
          className="lobby__input"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="Private room code"
          maxLength={CODE_LENGTH + 4}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="reset"
          disabled={!connected || pending || code.length < CODE_LENGTH}
        >
          Join
        </button>
      </form>

      {pending && <p className="lobby__hint">Joining…</p>}
      {error && (
        <p className="lobby__error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="link-button" onClick={onPlayLocal}>
        Play on this device instead
      </button>
    </section>
  );
}
