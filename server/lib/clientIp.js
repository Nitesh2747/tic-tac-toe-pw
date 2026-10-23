import { TRUST_PROXY } from "../config.js";

// The address a socket connected from.
//
// Behind a proxy every connection appears to come from the proxy itself, so the
// real address is in X-Forwarded-For. The proxy APPENDS the address it saw, so
// the LAST entry is the trustworthy one; earlier entries can be forged by the
// client. Without a trusted proxy the header is ignored completely.
export function getClientIp(socket, trustProxy = TRUST_PROXY) {
  if (trustProxy) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim() !== "") {
      return forwarded.split(",").at(-1).trim();
    }
  }
  return socket.handshake.address ?? "unknown";
}
