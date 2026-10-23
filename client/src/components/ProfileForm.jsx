import { useState } from "react";
import Avatar from "./Avatar.jsx";
import {
  NAME_MIN,
  NAME_MAX,
  cleanName,
  isValidName,
  newAvatarSeed,
} from "../game/profile.js";

// Pick a name and roll an avatar. `initial` is the current profile when editing.
export default function ProfileForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [avatarSeed, setAvatarSeed] = useState(initial?.avatarSeed ?? newAvatarSeed);
  const [tried, setTried] = useState(false); // only show the error after a first attempt

  const cleaned = cleanName(name);
  const valid = isValidName(cleaned);
  const showError = tried && !valid;

  function handleSubmit(event) {
    event.preventDefault();
    setTried(true);
    if (valid) onSave({ name: cleaned, avatarSeed });
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <div className="profile-form__avatar">
        <Avatar seed={avatarSeed} size={64} />
        <button
          type="button"
          className="link-button"
          onClick={() => setAvatarSeed(newAvatarSeed())}
        >
          New avatar
        </button>
      </div>

      <label htmlFor="player-name" className="profile-form__label">
        Your name
      </label>
      <input
        id="player-name"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={32}
        autoComplete="off"
        autoFocus={!initial}
        aria-invalid={showError}
        aria-describedby="player-name-hint"
      />
      <p
        id="player-name-hint"
        className={`profile-form__hint ${showError ? "profile-form__hint--error" : ""}`}
        role={showError ? "alert" : undefined}
      >
        {showError
          ? `Use ${NAME_MIN} to ${NAME_MAX} characters.`
          : `${NAME_MIN} to ${NAME_MAX} characters. Shown to other players.`}
      </p>

      <div className="actions">
        <button type="submit" className="reset reset--highlight">
          {initial ? "Save" : "Continue"}
        </button>
        {onCancel && (
          <button type="button" className="reset" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
