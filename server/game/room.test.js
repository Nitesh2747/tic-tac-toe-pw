import { describe, it, expect } from "vitest";
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  makeMove,
  markDisconnected,
  resetGame,
  getPublicState,
} from "./room.js";

// A room with X (player "pX") and O (player "pO") both seated.
function seatedRoom() {
  const room = createRoom();
  joinRoom(room, "pX", "sX");
  joinRoom(room, "pO", "sO");
  return room;
}

// Plays [playerId, index] pairs, failing loudly if a move is refused.
function play(room, moves) {
  for (const [playerId, index] of moves) {
    const result = makeMove(room, playerId, index);
    expect(result).toEqual({ ok: true });
  }
}

describe("joinRoom", () => {
  it("seats the first player as X and the second as O", () => {
    const room = createRoom();
    expect(joinRoom(room, "p1", "s1")).toBe("X");
    expect(joinRoom(room, "p2", "s2")).toBe("O");
  });

  it("refuses a third player", () => {
    const room = seatedRoom();
    expect(joinRoom(room, "p3", "s3")).toBeNull();
  });

  it("gives a returning player their old seat", () => {
    const room = seatedRoom();
    expect(joinRoom(room, "pO", "sO-new")).toBe("O");
    expect(room.players.O.socketId).toBe("sO-new");
  });
});

describe("makeMove", () => {
  it("is refused until both players are seated", () => {
    const room = createRoom();
    joinRoom(room, "pX", "sX");
    expect(makeMove(room, "pX", 0).error).toBe("Waiting for an opponent");
  });

  it("enforces turn order", () => {
    const room = seatedRoom();
    expect(makeMove(room, "pO", 0).error).toBe("Not your turn");
    play(room, [["pX", 0]]);
    expect(makeMove(room, "pX", 1).error).toBe("Not your turn");
  });

  it("refuses taken squares and invalid indexes", () => {
    const room = seatedRoom();
    play(room, [["pX", 0]]);
    expect(makeMove(room, "pO", 0).error).toBe("Square already taken");
    expect(makeMove(room, "pO", 9).error).toBe("Invalid square");
    expect(makeMove(room, "pO", -1).error).toBe("Invalid square");
    expect(makeMove(room, "pO", 1.5).error).toBe("Invalid square");
    expect(makeMove(room, "pO", "1").error).toBe("Invalid square");
  });

  it("refuses moves from someone who is not in the room", () => {
    const room = seatedRoom();
    expect(makeMove(room, "stranger", 0).error).toBe("You are not in this room");
  });

  it("refuses moves while the opponent is disconnected", () => {
    const room = seatedRoom();
    markDisconnected(room, "pO", "sO");
    expect(makeMove(room, "pX", 0).error).toBe("Opponent disconnected");
  });

  it("refuses moves after the game is won", () => {
    const room = seatedRoom();
    play(room, [["pX", 0], ["pO", 3], ["pX", 1], ["pO", 4], ["pX", 2]]);
    expect(makeMove(room, "pO", 8).error).toBe("The game is over");
  });
});

describe("resetGame", () => {
  it("is refused while a game is in progress", () => {
    const room = seatedRoom();
    play(room, [["pX", 0]]);
    expect(resetGame(room, "pX").error).toBe("The game is still in progress");
  });

  it("clears the board after the game is over, and the other player starts", () => {
    const room = seatedRoom();
    play(room, [["pX", 0], ["pO", 3], ["pX", 1], ["pO", 4], ["pX", 2]]);
    expect(resetGame(room, "pO")).toEqual({ ok: true });
    expect(room.board.every((cell) => cell === null)).toBe(true);
    expect(room.xIsNext).toBe(false); // round 2: O moves first
  });
});

describe("leaveRoom", () => {
  it("frees the seat and restarts the game for whoever stays", () => {
    const room = seatedRoom();
    play(room, [["pX", 0]]);
    expect(leaveRoom(room, "pX")).toBe(true);
    expect(room.players.X).toBeNull();
    expect(room.board.every((cell) => cell === null)).toBe(true);
    expect(getPublicState(room).status).toBe("waiting");
  });

  it("deletes the room once both seats are empty", () => {
    const room = seatedRoom();
    leaveRoom(room, "pX");
    expect(getRoom(room.id)).toBe(room);
    leaveRoom(room, "pO");
    expect(getRoom(room.id)).toBeUndefined();
  });

  it("returns false for someone who was never seated", () => {
    const room = seatedRoom();
    expect(leaveRoom(room, "stranger")).toBe(false);
  });
});

describe("markDisconnected", () => {
  it("marks the seat away, and rejoining brings it back", () => {
    const room = seatedRoom();
    expect(markDisconnected(room, "pO", "sO")).toBe(true);
    expect(getPublicState(room).players.O.connected).toBe(false);
    joinRoom(room, "pO", "sO-new");
    expect(getPublicState(room).players.O.connected).toBe(true);
  });

  it("ignores a late disconnect from an old socket", () => {
    const room = seatedRoom();
    joinRoom(room, "pO", "sO-new"); // refreshed: new socket already joined
    expect(markDisconnected(room, "pO", "sO")).toBe(false);
    expect(room.players.O.connected).toBe(true);
  });
});

describe("getPublicState", () => {
  it("never leaks player ids or socket ids", () => {
    const json = JSON.stringify(getPublicState(seatedRoom()));
    for (const secret of ["pX", "pO", "sX", "sO"]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("scoreboard", () => {
  const X_WINS = [["pX", 0], ["pO", 3], ["pX", 1], ["pO", 4], ["pX", 2]];
  const O_WINS = [["pO", 0], ["pX", 3], ["pO", 1], ["pX", 4], ["pO", 2]];
  // Final board: X O X / X O O / O X X  (nobody wins)
  const DRAW = [["pX", 0], ["pO", 1], ["pX", 2], ["pO", 4], ["pX", 3], ["pO", 5], ["pX", 7], ["pO", 6], ["pX", 8]];

  it("starts at zero", () => {
    expect(getPublicState(seatedRoom()).scores).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it("counts a win for X", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    expect(room.scores).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it("counts a draw", () => {
    const room = seatedRoom();
    play(room, DRAW);
    expect(room.scores).toEqual({ X: 0, O: 0, draws: 1 });
  });

  it("does not change the score on moves that do not end the game", () => {
    const room = seatedRoom();
    play(room, [["pX", 0], ["pO", 3], ["pX", 1]]);
    expect(room.scores).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it("counts a finished game only once, even if more moves are attempted", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    makeMove(room, "pO", 8);
    makeMove(room, "pX", 8);
    resetGame(room, "pX");
    expect(room.scores.X).toBe(1);
  });

  it("alternates who moves first each round", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    resetGame(room, "pX");
    expect(room.xIsNext).toBe(false); // round 2: O starts
    expect(makeMove(room, "pX", 0).error).toBe("Not your turn");
    play(room, O_WINS);
    resetGame(room, "pO");
    expect(room.xIsNext).toBe(true); // round 3: X starts again
  });

  it("keeps a running total across rounds", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    resetGame(room, "pX");
    play(room, O_WINS);
    resetGame(room, "pO");
    play(room, DRAW);
    expect(room.scores).toEqual({ X: 1, O: 1, draws: 1 });
  });

  it("keeps the score when a player leaves", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    leaveRoom(room, "pO");
    expect(room.scores).toEqual({ X: 1, O: 0, draws: 0 });
    expect(getPublicState(room).scores.X).toBe(1);
    expect(room.board.every((cell) => cell === null)).toBe(true);
  });

  it("keeps the score when the same player comes back", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    leaveRoom(room, "pO");
    expect(joinRoom(room, "pO", "sO-new")).toBe("O");
    expect(room.scores).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it("keeps the score when the room creator leaves and comes back", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    leaveRoom(room, "pX");
    expect(joinRoom(room, "pX", "sX-new")).toBe("X");
    expect(room.scores).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it("clears the score when a different player takes the seat", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    resetGame(room, "pX");
    leaveRoom(room, "pO");
    expect(joinRoom(room, "pNew", "sNew")).toBe("O");
    expect(room.scores).toEqual({ X: 0, O: 0, draws: 0 });
    expect(room.xIsNext).toBe(true); // a brand new pairing: X starts
    play(room, [["pX", 0]]);
    expect(room.board[0]).toBe("X");
  });

  it("the original player cannot reclaim the score after being replaced", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    leaveRoom(room, "pO");
    joinRoom(room, "pNew", "sNew");
    leaveRoom(room, "pNew");
    joinRoom(room, "pO", "sO-back"); // pO returns, but pNew had the seat in between
    expect(room.scores).toEqual({ X: 0, O: 0, draws: 0 });
  });

  it("moves on to the next starter when someone leaves after a finished round", () => {
    const room = seatedRoom();
    play(room, X_WINS); // finished, X had started
    leaveRoom(room, "pO");
    joinRoom(room, "pO", "sO-new");
    expect(room.xIsNext).toBe(false); // next round: O starts
  });

  it("replays the same round, same starter, when someone leaves mid-round", () => {
    const room = seatedRoom();
    play(room, [["pX", 0], ["pO", 1]]); // abandoned mid-round, X had started
    leaveRoom(room, "pO");
    joinRoom(room, "pO", "sO-new");
    expect(room.xIsNext).toBe(true);
    expect(room.board.every((cell) => cell === null)).toBe(true);
  });

  it("sends the score in the public state", () => {
    const room = seatedRoom();
    play(room, X_WINS);
    expect(getPublicState(room).scores).toEqual({ X: 1, O: 0, draws: 0 });
  });
});

describe("seat profiles", () => {
  const ada = { name: "Ada", avatarSeed: "adaseed001" };
  const bob = { name: "Bob", avatarSeed: "bobseed001" };

  function roomWithProfiles() {
    const room = createRoom();
    joinRoom(room, "pX", "sX", ada);
    joinRoom(room, "pO", "sO", bob);
    return room;
  }

  it("shows each player's name and avatar seed in the public state", () => {
    const { players } = getPublicState(roomWithProfiles());
    expect(players.X).toEqual({ connected: true, name: "Ada", avatarSeed: "adaseed001" });
    expect(players.O).toEqual({ connected: true, name: "Bob", avatarSeed: "bobseed001" });
  });

  it("still never leaks player ids or socket ids", () => {
    const json = JSON.stringify(getPublicState(roomWithProfiles()));
    for (const secret of ["pX", "pO", "sX", "sO"]) expect(json).not.toContain(secret);
  });

  it("lets a returning player update their name and avatar", () => {
    const room = roomWithProfiles();
    joinRoom(room, "pX", "sX-new", { name: "Ada L", avatarSeed: "newseed001" });
    expect(getPublicState(room).players.X).toMatchObject({ name: "Ada L", avatarSeed: "newseed001" });
  });

  it("keeps the name of a player who disconnected", () => {
    const room = roomWithProfiles();
    markDisconnected(room, "pO", "sO");
    expect(getPublicState(room).players.O).toEqual({ connected: false, name: "Bob", avatarSeed: "bobseed001" });
  });

  it("empties the seat's public info when the player leaves", () => {
    const room = roomWithProfiles();
    leaveRoom(room, "pO");
    expect(getPublicState(room).players.O).toBeNull();
  });

  it("falls back to a default profile when none is given (tests and scripts only)", () => {
    const room = createRoom();
    joinRoom(room, "p1", "s1");
    expect(getPublicState(room).players.X.name).toBe("Player");
  });
});

