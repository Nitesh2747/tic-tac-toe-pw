import { useState } from "react";
import {
  ROOM_NAME_MIN,
  ROOM_NAME_MAX,
  cleanName,
  isValidRoomName,
} from "../game/profile.js";

// Pick a name and whether the room is public or private.
export default function CreateRoomForm({ profile, busy, error, onCreate, onCancel }) {
  const defaultName = `${profile.name}'s room`;
  const [roomName, setRoomName] = useState(defaultName);
  const [visibility, setVisibility] = useState("public");
  const [tried, setTried] = useState(false);

  // An empty name means "use the default", like the server does.
  const cleaned = cleanName(roomName) || defaultName;
  const valid = isValidRoomName(cleaned);
  const showError = tried && !valid;

  function handleSubmit(event) {
    event.preventDefault();
    setTried(true);
    if (valid) onCreate({ roomName: cleaned, visibility });
  }

  return (
    <form className="create-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="room-name" className="profile-form__label">
        Room name
      </label>
      <input
        id="room-name"
        className="text-input"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        maxLength={40}
        autoComplete="off"
        aria-invalid={showError}
        aria-describedby="room-name-hint"
      />
      <p
        id="room-name-hint"
        className={`profile-form__hint ${showError ? "profile-form__hint--error" : ""}`}
        role={showError ? "alert" : undefined}
      >
        {showError
          ? `Use ${ROOM_NAME_MIN} to ${ROOM_NAME_MAX} characters.`
          : `${ROOM_NAME_MIN} to ${ROOM_NAME_MAX} characters.`}
      </p>

      <fieldset className="create-form__choice">
        <legend className="visually-hidden">Who can join</legend>
        <label className={`choice ${visibility === "public" ? "choice--on" : ""}`}>
          <input
            type="radio"
            name="visibility"
            value="public"
            checked={visibility === "public"}
            onChange={() => setVisibility("public")}
          />
          <span className="choice__title">Public</span>
          <span className="choice__hint">Listed in the lobby</span>
        </label>
        <label className={`choice ${visibility === "private" ? "choice--on" : ""}`}>
          <input
            type="radio"
            name="visibility"
            value="private"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
          />
          <span className="choice__title">Private</span>
          <span className="choice__hint">Code or link only</span>
        </label>
      </fieldset>

      {error && (
        <p className="lobby__error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="reset reset--highlight" disabled={busy}>
          Create
        </button>
        <button type="button" className="reset" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
