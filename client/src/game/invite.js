// Invite links.
//   public room:   https://site/?room=<id>   (the id is not a secret)
//   private room:  https://site/?code=<code> (the code IS the secret: whoever has
//                                             the link can join, so share it with care)
// Opening a link joins the room directly.

export const CODE_LENGTH = 6;

// People type and paste codes: ignore case, spaces and dashes.
export function normalizeCode(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

// Reads a link's query string ("?code=ABC123"). Returns { code }, { roomId } or null.
export function parseInvite(search) {
  const params = new URLSearchParams(search);

  const code = normalizeCode(params.get("code"));
  if (code.length === CODE_LENGTH) return { code };

  const roomId = (params.get("room") ?? "").trim();
  if (/^[A-Za-z0-9]{6,32}$/.test(roomId)) return { roomId };

  return null;
}

export function buildInviteLink(origin, { visibility, roomId, code }) {
  return visibility === "private" ? `${origin}/?code=${code}` : `${origin}/?room=${roomId}`;
}
