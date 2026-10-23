import { describe, it, expect } from "vitest";
import { getClientIp } from "./clientIp.js";

const socket = (address, forwarded) => ({
  handshake: { address, headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded } },
});

describe("getClientIp", () => {
  it("uses the connection's own address by default", () => {
    expect(getClientIp(socket("203.0.113.5"), false)).toBe("203.0.113.5");
  });

  it("IGNORES X-Forwarded-For when no proxy is trusted (a client could forge it)", () => {
    expect(getClientIp(socket("203.0.113.5", "1.2.3.4"), false)).toBe("203.0.113.5");
  });

  it("behind a trusted proxy, uses the LAST entry: the one the proxy added", () => {
    expect(getClientIp(socket("10.0.0.1", "198.51.100.9"), true)).toBe("198.51.100.9");
    expect(getClientIp(socket("10.0.0.1", "6.6.6.6, 198.51.100.9"), true)).toBe("198.51.100.9");
  });

  it("falls back to the socket address if the header is missing or blank", () => {
    expect(getClientIp(socket("10.0.0.1"), true)).toBe("10.0.0.1");
    expect(getClientIp(socket("10.0.0.1", "  "), true)).toBe("10.0.0.1");
  });

  it("never returns undefined", () => {
    expect(getClientIp(socket(undefined), false)).toBe("unknown");
  });
});
