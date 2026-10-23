// Your public profile: a display name and an avatar seed, kept in this browser.
//
// cleanName must behave exactly like cleanName in server/lib/profile.js. The
// server is the one that decides; this copy lets the form preview what the
// server will accept.

export const NAME_MIN = 2;
export const NAME_MAX = 16;

const KEY = "ttt-profile";
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

// Room names follow the same cleaning rules as player names, but may be longer.
export const ROOM_NAME_MIN = 2;
export const ROOM_NAME_MAX = 24;

export function isValidRoomName(name) {
  const length = [...name].length;
  return length >= ROOM_NAME_MIN && length <= ROOM_NAME_MAX;
}

export function isAvatarSeed(value) {
  return typeof value === "string" && AVATAR_SEED.test(value);
}

// A random public seed for drawing an avatar. 64 random bits as hex.
export function newAvatarSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Returns { name, avatarSeed } or null if nothing valid is saved.
export function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const name = cleanName(saved?.name);
    if (isValidName(name) && isAvatarSeed(saved?.avatarSeed)) {
      return { name, avatarSeed: saved.avatarSeed };
    }
  } catch {
    /* storage unavailable or corrupted: treat as "no profile yet" */
  }
  return null;
}

// Saves the profile and returns the cleaned version that was stored.
export function saveProfile(profile) {
  const clean = { name: cleanName(profile.name), avatarSeed: profile.avatarSeed };
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* it still works for this visit */
  }
  return clean;
}
