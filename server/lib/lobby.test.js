import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scheduleLobbyUpdate, LOBBY_ROOM } from "./lobby.js";
import { createRoom, joinRoom, removeRoom, listPublicRooms, getRoom } from "../game/room.js";

function fakeIo() {
  const emitted = [];
  return {
    emitted,
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  for (const entry of listPublicRooms()) removeRoom(getRoom(entry.id));
});

describe("scheduleLobbyUpdate", () => {
  it("sends the public list to the lobby after the delay, not before", () => {
    const io = fakeIo();
    const room = createRoom({ name: "Open" });
    joinRoom(room, "p1", "s1");
    scheduleLobbyUpdate(io, 300);
    expect(io.emitted).toHaveLength(0);
    vi.advanceTimersByTime(299);
    expect(io.emitted).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(io.emitted).toHaveLength(1);
    expect(io.emitted[0].room).toBe(LOBBY_ROOM);
    expect(io.emitted[0].event).toBe("lobby:rooms");
    expect(io.emitted[0].payload.map((r) => r.name)).toEqual(["Open"]);
  });

  it("folds a burst of changes into ONE update", () => {
    const io = fakeIo();
    for (let i = 0; i < 20; i++) scheduleLobbyUpdate(io, 300);
    vi.advanceTimersByTime(300);
    expect(io.emitted).toHaveLength(1);
  });

  it("the update reflects changes made while it was waiting", () => {
    const io = fakeIo();
    scheduleLobbyUpdate(io, 300);
    const room = createRoom({ name: "Late arrival" });
    joinRoom(room, "p1", "s1");
    vi.advanceTimersByTime(300);
    expect(io.emitted[0].payload.map((r) => r.name)).toEqual(["Late arrival"]);
  });

  it("can send again after an update has gone out", () => {
    const io = fakeIo();
    scheduleLobbyUpdate(io, 300); vi.advanceTimersByTime(300);
    scheduleLobbyUpdate(io, 300); vi.advanceTimersByTime(300);
    expect(io.emitted).toHaveLength(2);
  });

  it("never includes private rooms", () => {
    const io = fakeIo();
    const secret = createRoom({ name: "Secret", visibility: "private" });
    joinRoom(secret, "p1", "s1");
    scheduleLobbyUpdate(io, 300); vi.advanceTimersByTime(300);
    expect(io.emitted[0].payload).toEqual([]);
    expect(JSON.stringify(io.emitted)).not.toContain(secret.code);
    removeRoom(secret);
  });
});
