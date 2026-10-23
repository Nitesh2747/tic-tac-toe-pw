import { describe, it, expect } from "vitest";
import {
  CODE_CHARS,
  CODE_LENGTH,
  ROOM_ID_LENGTH,
  createRoom,
  findJoinTarget,
  findRoomByCode,
  getPublicState,
  getRoom,
  getRoleOf,
  isBanned,
  joinRoom,
  kickPlayer,
  leaveRoom,
  listPublicRooms,
  makeMove,
  markDisconnected,
  normalizeCode,
  removeRoom,
  rotateCode,
} from "./room.js";

const CODE_FORMAT = new RegExp(`^[${CODE_CHARS}]{${CODE_LENGTH}}$`);
const ada = { name: "Ada", avatarSeed: "adaseed001" };
const bob = { name: "Bob", avatarSeed: "bobseed001" };

// A room with host "pHost" (seat X) and, optionally, guest "pGuest" (seat O).
function hostedRoom(options = {}, withGuest = true) {
  const room = createRoom(options);
  joinRoom(room, "pHost", "sHost", ada);
  if (withGuest) joinRoom(room, "pGuest", "sGuest", bob);
  return room;
}

describe("room name and display (public / private)", () => {
  it("defaults to a public room", () => {
    const room = createRoom();
    expect(room.visibility).toBe("public");
    expect(room.code).toBeNull();
  });

  it("keeps the name and display it was given", () => {
    const room = createRoom({ name: "Friday night", visibility: "private" });
    expect(room.name).toBe("Friday night");
    expect(room.visibility).toBe("private");
  });

  it("treats anything other than 'private' as public", () => {
    expect(createRoom({ visibility: "secret" }).visibility).toBe("public");
  });

  it("the public state NEVER contains a private room's code", () => {
    const room = hostedRoom({ visibility: "private" });
    const json = JSON.stringify(getPublicState(room));
    expect(json).not.toContain(room.code);
    expect(json).not.toContain('"code"');
    for (const [key] of Object.entries(getPublicState(room))) expect(key).not.toMatch(/code|host(Id)?$/i);
  });

  it("shows the name and display in the public state", () => {
    const state = getPublicState(createRoom({ name: "Hello", visibility: "private" }));
    expect(state.name).toBe("Hello");
    expect(state.visibility).toBe("private");
  });
});

describe("room ids and private codes", () => {
  it("public rooms have an id but no code", () => {
    const room = createRoom();
    expect(room.id).toHaveLength(ROOM_ID_LENGTH);
    expect(room.code).toBeNull();
  });

  it("private codes are 6 readable characters, never the room id", () => {
    for (let i = 0; i < 100; i++) {
      const room = createRoom({ visibility: "private" });
      expect(room.code).toMatch(CODE_FORMAT);
      expect(room.code).not.toBe(room.id);
      removeRoom(room);
    }
  });

  it("codes are unique across rooms", () => {
    const rooms = Array.from({ length: 400 }, () => createRoom({ visibility: "private" }));
    expect(new Set(rooms.map((r) => r.code)).size).toBe(400);
    rooms.forEach(removeRoom);
  });

  it("finds a private room by its code, ignoring case, spaces and dashes", () => {
    const room = createRoom({ visibility: "private" });
    const spaced = `${room.code.slice(0, 3)}-${room.code.slice(3)}`.toLowerCase();
    expect(findRoomByCode(room.code)).toBe(room);
    expect(findRoomByCode(` ${spaced} `)).toBe(room);
    removeRoom(room);
  });

  it("does not find anything for a wrong, empty or odd code", () => {
    for (const bad of ["", "AAAAAA", "x", null, undefined, 123456, {}]) {
      expect(findRoomByCode(bad)).toBeUndefined();
    }
  });

  it("a code stops working once the room is gone", () => {
    const room = createRoom({ visibility: "private" });
    joinRoom(room, "p1", "s1", ada);
    const { code } = room;
    leaveRoom(room, "p1"); // last player leaves: the room is deleted
    expect(findRoomByCode(code)).toBeUndefined();
    expect(getRoom(room.id)).toBeUndefined();
  });

  it("normalizeCode keeps only letters and digits, uppercased", () => {
    expect(normalizeCode(" ab-c 12 ")).toBe("ABC12");
  });
});

describe("joining: by id (public) or by code (private)", () => {
  it("a public room can be joined by its id", () => {
    const room = hostedRoom({}, false);
    expect(findJoinTarget({ roomId: room.id }, "someone")).toEqual({ room });
    expect(findJoinTarget({ roomId: room.id.toLowerCase() }, "someone")).toEqual({ room });
  });

  it("a private room can be joined by its code", () => {
    const room = hostedRoom({ visibility: "private" }, false);
    expect(findJoinTarget({ code: room.code }, "someone")).toEqual({ room });
  });

  it("a private room can NOT be entered by id by someone who is not seated in it", () => {
    const room = hostedRoom({ visibility: "private" }, false);
    expect(findJoinTarget({ roomId: room.id }, "stranger").error).toBe("Room not found");
  });

  it("but a seated player can rejoin a private room by id (refresh)", () => {
    const room = hostedRoom({ visibility: "private" });
    expect(findJoinTarget({ roomId: room.id }, "pGuest")).toEqual({ room });
  });

  it("a wrong code and a missing room give a plain error", () => {
    expect(findJoinTarget({ code: "ZZZZZZ" }, "p").error).toBe("No room found for that code");
    expect(findJoinTarget({ roomId: "NOPE" }, "p").error).toBe("Room not found");
    expect(findJoinTarget({}, "p").error).toBe("Missing room");
  });

  it("a code wins over an id", () => {
    const priv = hostedRoom({ visibility: "private" }, false);
    const pub = hostedRoom({}, false);
    expect(findJoinTarget({ roomId: pub.id, code: priv.code }, "p")).toEqual({ room: priv });
  });
});

describe("host", () => {
  it("the first player to sit down is the host", () => {
    const room = hostedRoom();
    expect(room.hostId).toBe("pHost");
    expect(getPublicState(room).hostSeat).toBe("X");
  });

  it("there is no host until someone sits down", () => {
    expect(getPublicState(createRoom()).hostSeat).toBeNull();
  });

  it("the host role passes to the other player when the host leaves", () => {
    const room = hostedRoom();
    leaveRoom(room, "pHost");
    expect(room.hostId).toBe("pGuest");
    expect(getPublicState(room).hostSeat).toBe("O");
  });

  it("a host who comes back is no longer the host", () => {
    const room = hostedRoom();
    leaveRoom(room, "pHost");
    joinRoom(room, "pHost", "sHost2", ada);
    expect(room.hostId).toBe("pGuest");
  });

  it("the guest leaving does not change the host", () => {
    const room = hostedRoom();
    leaveRoom(room, "pGuest");
    expect(room.hostId).toBe("pHost");
  });

  it("the public state never contains the host's id", () => {
    expect(JSON.stringify(getPublicState(hostedRoom()))).not.toContain("pHost");
  });
});

describe("kicking", () => {
  it("only the host can kick", () => {
    const room = hostedRoom();
    expect(kickPlayer(room, "pGuest", "X").error).toBe("Only the host can remove players");
    expect(kickPlayer(room, "stranger", "O").error).toBe("Only the host can remove players");
    expect(room.players.O).not.toBeNull();
  });

  it("removes the player, bans them and keeps the host", () => {
    const room = hostedRoom();
    const result = kickPlayer(room, "pHost", "O");
    expect(result.ok).toBe(true);
    expect(result.kicked).toEqual({ playerId: "pGuest", socketId: "sGuest" });
    expect(room.players.O).toBeNull();
    expect(isBanned(room, "pGuest")).toBe(true);
    expect(room.hostId).toBe("pHost");
  });

  it("rejects bad seats, empty seats and kicking yourself", () => {
    const room = hostedRoom({}, false);
    expect(kickPlayer(room, "pHost", "Z").error).toBe("Invalid player");
    expect(kickPlayer(room, "pHost", undefined).error).toBe("Invalid player");
    expect(kickPlayer(room, "pHost", "O").error).toBe("Nobody is sitting there");
    expect(kickPlayer(room, "pHost", "X").error).toBe("You cannot remove yourself");
  });

  it("the game restarts and the score belongs to nobody new", () => {
    const room = hostedRoom();
    makeMove(room, "pHost", 0);
    kickPlayer(room, "pHost", "O");
    expect(room.board.every((cell) => cell === null)).toBe(true);
    joinRoom(room, "pNew", "sNew", bob);
    expect(room.scores).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it("a kicked player is not seated any more and a new player can take the seat", () => {
    const room = hostedRoom();
    kickPlayer(room, "pHost", "O");
    expect(getRoleOf(room, "pGuest")).toBeNull();
    expect(joinRoom(room, "pNew", "sNew", bob)).toBe("O");
  });

  it("kicking in a PRIVATE room replaces the code, so the old one is useless", () => {
    const room = hostedRoom({ visibility: "private" });
    const oldCode = room.code;
    kickPlayer(room, "pHost", "O");
    expect(room.code).not.toBe(oldCode);
    expect(room.code).toMatch(CODE_FORMAT);
    expect(findRoomByCode(oldCode)).toBeUndefined();
    expect(findRoomByCode(room.code)).toBe(room);
  });

  it("kicking in a PUBLIC room has no code to replace", () => {
    const room = hostedRoom();
    kickPlayer(room, "pHost", "O");
    expect(room.code).toBeNull();
  });

  it("if the host was away, a returning guest cannot kick; only the host can", () => {
    const room = hostedRoom();
    leaveRoom(room, "pHost"); // guest becomes host
    expect(kickPlayer(room, "pHost", "O").error).toBe("Only the host can remove players");
  });
});

describe("rotateCode", () => {
  it("gives a private room a new valid code and retires the old one", () => {
    const room = createRoom({ visibility: "private" });
    const old = room.code;
    expect(rotateCode(room)).toMatch(CODE_FORMAT);
    expect(findRoomByCode(old)).toBeUndefined();
    removeRoom(room);
  });

  it("does nothing for a public room", () => {
    expect(rotateCode(createRoom())).toBeNull();
  });
});

describe("the lobby list: public rooms only", () => {
  function clearAll() {
    for (const entry of listPublicRooms()) removeRoom(getRoom(entry.id));
  }

  it("lists public rooms with a name and display, and nothing secret", () => {
    clearAll();
    const room = hostedRoom({ name: "Open table" });
    const list = listPublicRooms();
    expect(list).toEqual([
      { id: room.id, name: "Open table", display: "public", players: 2, full: true },
    ]);
    clearAll();
  });

  it("NEVER lists a private room, however many exist", () => {
    clearAll();
    const priv = Array.from({ length: 5 }, (_, i) => hostedRoom({ name: `Secret ${i}`, visibility: "private" }, false));
    const pub = hostedRoom({ name: "Public one" }, false);
    const list = listPublicRooms();
    expect(list.map((r) => r.name)).toEqual(["Public one"]);
    const json = JSON.stringify(list);
    for (const r of priv) {
      expect(json).not.toContain(r.code);
      expect(json).not.toContain(r.id);
      expect(json).not.toContain(r.name);
    }
    removeRoom(pub);
    priv.forEach(removeRoom);
  });

  it("never contains codes, player ids or socket ids", () => {
    clearAll();
    hostedRoom({ name: "Open" });
    const json = JSON.stringify(listPublicRooms());
    for (const secret of ["pHost", "pGuest", "sHost", "sGuest", "hostId", "code"]) {
      expect(json).not.toContain(secret);
    }
    clearAll();
  });

  it("shows how many players are in, and whether it is full", () => {
    clearAll();
    hostedRoom({ name: "One" }, false);
    hostedRoom({ name: "Two" }, true);
    const byName = Object.fromEntries(listPublicRooms().map((r) => [r.name, r]));
    expect(byName.One).toMatchObject({ players: 1, full: false });
    expect(byName.Two).toMatchObject({ players: 2, full: true });
    clearAll();
  });

  it("puts rooms with a free seat first, then newest first", () => {
    clearAll();
    const full = hostedRoom({ name: "Full" });
    const older = hostedRoom({ name: "Older open" }, false);
    const newer = hostedRoom({ name: "Newer open" }, false);
    older.createdAt = 1000; newer.createdAt = 2000; full.createdAt = 3000;
    expect(listPublicRooms().map((r) => r.name)).toEqual(["Newer open", "Older open", "Full"]);
    clearAll();
  });

  it("a room disappears from the list when everyone leaves", () => {
    clearAll();
    const room = hostedRoom({ name: "Short lived" }, false);
    expect(listPublicRooms()).toHaveLength(1);
    leaveRoom(room, "pHost");
    expect(listPublicRooms()).toHaveLength(0);
  });

  it("is capped at 100 rooms", () => {
    clearAll();
    const made = Array.from({ length: 130 }, (_, i) => hostedRoom({ name: `Room ${i}` }, false));
    expect(listPublicRooms()).toHaveLength(100);
    made.forEach(removeRoom);
  });

  it("hides a room while every player in it is disconnected, and shows it again on return", () => {
    clearAll();
    const room = hostedRoom({ name: "Ghost town" }, false);
    markDisconnected(room, "pHost", "sHost");
    expect(listPublicRooms()).toHaveLength(0);
    joinRoom(room, "pHost", "sHost-new", ada); // reconnects
    expect(listPublicRooms().map((r) => r.name)).toEqual(["Ghost town"]);
    clearAll();
  });

  it("keeps listing a room while at least one player is still online", () => {
    clearAll();
    const room = hostedRoom({ name: "Half empty" });
    markDisconnected(room, "pGuest", "sGuest");
    expect(listPublicRooms().map((r) => r.name)).toEqual(["Half empty"]);
    clearAll();
  });

  it("does not list a room nobody is sitting in", () => {
    clearAll();
    createRoom({ name: "Ghost" });
    expect(listPublicRooms()).toHaveLength(0);
  });
});
