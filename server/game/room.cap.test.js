import { describe, it, expect } from "vitest";
import { createRoom } from "./room.js";

// This lives in its own file on purpose: it fills the server's in-memory room
// store, and vitest gives every test file a fresh copy of the module, so it
// cannot starve the tests in room.test.js of rooms.
describe("createRoom", () => {
  it("stops creating rooms once the cap is reached", () => {
    let created = 0;
    while (createRoom() !== null) {
      created++;
      if (created > 5000) throw new Error("cap never reached");
    }
    expect(created).toBeGreaterThan(0);
    expect(createRoom()).toBeNull();
  });
});
