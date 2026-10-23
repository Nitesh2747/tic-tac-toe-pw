// A player's public profile: a display name and an avatar seed.
// Everything here comes from the client, so everything here is checked.
//
// cleanName must behave exactly like cleanName in client/src/game/profile.js
// (the client uses it to preview what the server will accept).

export const NAME_MIN = 2;
export const NAME_MAX = 16;

// Avatars are drawn from this seed on the client. It is public, and is NOT the
// playerId, which has to stay secret because it proves who owns a seat.
const AVATAR_SEED = /^[a-z0-9]{8,32}$/;

export function cleanName(raw) {
  if (typeof raw !== "string" || raw.length > 64) return "";
  return raw
    .normalize("NFC")
    // control characters, invisible "format" characters (zero-width spaces,
    // right-to-left overrides that can spoof text) and line separators
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function isValidName(name) {
  const length = [...name].length; // count characters, not UTF-16 units (emoji!)
  return length >= NAME_MIN && length <= NAME_MAX;
}

export function isAvatarSeed(value) {
  return typeof value === "string" && AVATAR_SEED.test(value);
}

// Reads { name, avatarSeed } out of an untrusted payload.
// Returns { ok: true, name, avatarSeed } or { ok: false, error }.
export function readProfile(payload) {
  const name = cleanName(payload?.name);
  if (!isValidName(name)) {
    return { ok: false, error: `Pick a name between ${NAME_MIN} and ${NAME_MAX} characters` };
  }
  if (!isAvatarSeed(payload?.avatarSeed)) {
    return { ok: false, error: "Invalid avatar" };
  }
  return { ok: true, name, avatarSeed: payload.avatarSeed };
}

export const ROOM_NAME_MIN = 2;
export const ROOM_NAME_MAX = 24;

export function isValidRoomName(name) {
  const length = [...name].length;
  return length >= ROOM_NAME_MIN && length <= ROOM_NAME_MAX;
}

// Reads the room settings out of an untrusted payload.
// Returns { ok: true, name, visibility } or { ok: false, error }.
// An empty room name falls back to "<host>'s room".
export function readRoomSettings(payload, hostName) {
  const visibility = payload?.visibility ?? "public";
  if (visibility !== "public" && visibility !== "private") {
    return { ok: false, error: "Invalid room type" };
  }

  const raw = payload?.roomName;
  if (raw === undefined || raw === null) {
    return { ok: true, name: `${hostName}'s room`, visibility };
  }
  if (typeof raw !== "string") return { ok: false, error: "Invalid room name" };

  const name = cleanName(raw);
  if (name === "") return { ok: true, name: `${hostName}'s room`, visibility };
  if (!isValidRoomName(name)) {
    return { ok: false, error: `Room name must be ${ROOM_NAME_MIN} to ${ROOM_NAME_MAX} characters` };
  }
  return { ok: true, name, visibility };
}

