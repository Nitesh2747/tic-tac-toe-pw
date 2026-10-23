const KEY = "ttt-player-id";

// Used only if the browser refuses to store anything (for example when cookies
// are blocked), so the id at least stays the same while the page stays open.
let memoryId = null;

// A random v4 UUID. crypto.randomUUID only exists on secure pages (https:// or
// localhost), so on a plain http:// address such as a LAN IP we build the same
// kind of id from getRandomValues, which works everywhere.
function makeUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

// A random id that identifies this browser to the server across reloads.
export function getPlayerId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = makeUuid();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage is blocked: getItem or setItem threw.
    memoryId ??= makeUuid();
    return memoryId;
  }
}
