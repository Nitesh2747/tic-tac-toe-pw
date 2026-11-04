// The rules of one Discord game: turns, wins, the computer's replies, rematches.
import { describe, expect, it } from "vitest";
import {
  COMPUTER,
  createGame,
  currentSeat,
  getResult,
  playMove,
  rematch,
  resign,
  seatOf,
} from "./game.js";

const ALICE = "100";
const BOB = "200";

// Plays a list of [userId, square] moves, and fails loudly if one is refused.
function play(game, moves) {
  for (const [userId, index] of moves) {
    const reply = playMove(game, userId, index, () => 0);
    if (!reply.ok) throw new Error(`Move ${index} was refused: ${reply.error}`);
    game = reply.game;
  }
  return game;
}

// Alice (X) takes the top row while Bob (O) plays elsewhere.
const ALICE_WINS = [[ALICE, 0], [BOB, 3], [ALICE, 1], [BOB, 4], [ALICE, 2]];

describe("starting a game", () => {
  it("starts with an empty board, X to move and a zero score", () => {
    const game = createGame({ x: ALICE, o: BOB });

    expect(game.board).toEqual(Array(9).fill(null));
    expect(currentSeat(game)).toBe("X");
    expect(game.scores).toEqual({ X: 0, O: 0, draws: 0 });
    expect(seatOf(game, ALICE)).toBe("X");
    expect(seatOf(game, BOB)).toBe("O");
    expect(seatOf(game, "999")).toBeNull();
  });

  it("refuses a game against yourself", () => {
    expect(() => createGame({ x: ALICE, o: ALICE })).toThrow("two different players");
  });

  it("needs a known level for a game against the computer", () => {
    expect(() => createGame({ x: ALICE, o: COMPUTER })).toThrow("needs a level");
    expect(() => createGame({ x: ALICE, o: COMPUTER, level: "impossible" })).toThrow("needs a level");
  });
});

describe("a move between two people", () => {
  it("places the mark and passes the turn", () => {
    const game = createGame({ x: ALICE, o: BOB });

    const reply = playMove(game, ALICE, 4);

    expect(reply).toMatchObject({ ok: true, computerMove: null });
    expect(reply.game.board[4]).toBe("X");
    expect(currentSeat(reply.game)).toBe("O");
    expect(reply.game.lastMove).toBe(4);
  });

  it("does not change the game it was given", () => {
    const game = createGame({ x: ALICE, o: BOB });
    const before = structuredClone(game);

    playMove(game, ALICE, 4);

    expect(game).toEqual(before);
  });

  it.each([
    ["someone who is not playing", "999", 0, "You're not playing in this game."],
    ["a move out of turn", BOB, 0, "It's not your turn."],
    ["a square below 0", ALICE, -1, "That square doesn't exist."],
    ["a square above 8", ALICE, 9, "That square doesn't exist."],
    ["a square that is not a whole number", ALICE, 1.5, "That square doesn't exist."],
    ["a square given as text", ALICE, "1", "That square doesn't exist."],
  ])("refuses %s", (_name, userId, index, error) => {
    const game = createGame({ x: ALICE, o: BOB });
    expect(playMove(game, userId, index)).toEqual({ ok: false, error });
  });

  it("refuses a square that is taken", () => {
    const game = play(createGame({ x: ALICE, o: BOB }), [[ALICE, 0]]);
    expect(playMove(game, BOB, 0)).toEqual({ ok: false, error: "That square is taken." });
  });
});

describe("finishing a round", () => {
  it("records a win, scores it and refuses further moves", () => {
    const game = play(createGame({ x: ALICE, o: BOB }), ALICE_WINS);

    expect(getResult(game)).toMatchObject({ over: true, winner: "X", line: [0, 1, 2], isDraw: false });
    expect(game.scores).toEqual({ X: 1, O: 0, draws: 0 });
    expect(currentSeat(game)).toBeNull();
    expect(playMove(game, BOB, 5)).toEqual({ ok: false, error: "This game is over." });
  });

  it("records a draw", () => {
    // X O X
    // X O O
    // O X X
    const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8].map((index, turn) => [turn % 2 === 0 ? ALICE : BOB, index]);

    const game = play(createGame({ x: ALICE, o: BOB }), moves);

    expect(getResult(game)).toMatchObject({ over: true, winner: null, isDraw: true });
    expect(game.scores).toEqual({ X: 0, O: 0, draws: 1 });
  });

  it("lets a player resign, and gives the other player the win", () => {
    const game = createGame({ x: ALICE, o: BOB });

    const reply = resign(game, ALICE);

    expect(getResult(reply.game)).toMatchObject({ over: true, winner: "O", resignedBy: "X" });
    expect(reply.game.scores).toEqual({ X: 0, O: 1, draws: 0 });
    expect(resign(reply.game, BOB)).toEqual({ ok: false, error: "This game is over." });
    expect(resign(game, "999")).toEqual({ ok: false, error: "You're not playing in this game." });
  });
});

describe("play again", () => {
  it("is refused while the round is still going", () => {
    const game = createGame({ x: ALICE, o: BOB });
    expect(rematch(game)).toEqual({ ok: false, error: "The game isn't finished yet." });
  });

  it("starts with the other player, keeps the seats and the score", () => {
    const finished = play(createGame({ x: ALICE, o: BOB }), ALICE_WINS);

    const { ok, game } = rematch(finished);

    expect(ok).toBe(true);
    expect(game.board).toEqual(Array(9).fill(null));
    expect(currentSeat(game)).toBe("O"); // Bob starts this time
    expect(game.players).toEqual({ X: ALICE, O: BOB });
    expect(game.scores).toEqual({ X: 1, O: 0, draws: 0 });
    // ...and the round after that starts with Alice again.
    const again = rematch(resign(game, BOB).game).game;
    expect(currentSeat(again)).toBe("X");
  });
});

describe("playing against the computer", () => {
  // random = () => 0 makes the computer's "any square" choices predictable: the first free square.
  const first = () => 0;

  it("plays the computer's reply in the same step", () => {
    const game = createGame({ x: ALICE, o: COMPUTER, level: "easy" });

    const reply = playMove(game, ALICE, 4, first);

    expect(reply.computerMove).toBe(0);
    expect(reply.game.board[4]).toBe("X");
    expect(reply.game.board[0]).toBe("O");
    expect(currentSeat(reply.game)).toBe("X"); // back to the person
  });

  it("blocks a win at medium level", () => {
    const game = createGame({ x: ALICE, o: COMPUTER, level: "medium" });
    const afterFirst = playMove(game, ALICE, 0, first).game; // computer plays square 1
    expect(afterFirst.board[1]).toBe("O");

    const reply = playMove(afterFirst, ALICE, 3, first); // X threatens 0-3-6

    expect(reply.computerMove).toBe(6);
  });

  it("can win, and then the game is over", () => {
    // The easy computer takes the first free square, so X can lose by ignoring it.
    let game = createGame({ x: ALICE, o: COMPUTER, level: "easy" });
    for (const square of [4, 5, 8]) game = playMove(game, ALICE, square, first).game;

    expect(getResult(game)).toMatchObject({ over: true, winner: "O", line: [0, 1, 2] });
    expect(game.scores).toEqual({ X: 0, O: 1, draws: 0 });
    expect(playMove(game, ALICE, 3, first)).toEqual({ ok: false, error: "This game is over." });
  });

  it("does not reply when the person's move won the round", () => {
    let game = createGame({ x: ALICE, o: COMPUTER, level: "easy" });
    // X plays 8, 7, 6 (the computer fills 0 and 1 first), so X completes the bottom row.
    for (const square of [8, 7]) game = playMove(game, ALICE, square, first).game;

    const reply = playMove(game, ALICE, 6, first);

    expect(reply.computerMove).toBeNull();
    expect(getResult(reply.game)).toMatchObject({ over: true, winner: "X" });
  });

  it("plays its opening move when a rematch starts with the computer", () => {
    const finished = resign(createGame({ x: ALICE, o: COMPUTER, level: "easy" }), ALICE).game;

    const { game } = rematch(finished, first);

    expect(game.board[0]).toBe("O"); // already played
    expect(game.lastMove).toBe(0);
    expect(currentSeat(game)).toBe("X"); // waiting for the person
  });
});