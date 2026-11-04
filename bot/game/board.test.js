// What a game looks like on screen: the text and the buttons.
import { describe, expect, it } from "vitest";
import { describeBoard } from "./board.js";
import { COMPUTER, createGame, playMove, resign } from "./game.js";

const ALICE = "100";
const BOB = "200";

// Plays [userId, square] moves on a game between two people.
function play(game, moves) {
  for (const [userId, index] of moves) game = playMove(game, userId, index, () => 0).game;
  return game;
}

const flat = (board) => board.rows.flat();

describe("the buttons", () => {
  it("shows an empty board as 9 grey, clickable buttons in 3 rows", () => {
    const board = describeBoard(createGame({ x: ALICE, o: BOB }));

    expect(board.rows.map((row) => row.length)).toEqual([3, 3, 3]);
    expect(flat(board).map((button) => button.customId)).toEqual(
      Array.from({ length: 9 }, (_, index) => `ttt:move:${index}`),
    );
    for (const button of flat(board)) {
      expect(button).toMatchObject({ label: "​", style: "secondary", disabled: false });
    }
  });

  it("shows X as red and O as blue, and locks the taken squares", () => {
    const game = play(createGame({ x: ALICE, o: BOB }), [[ALICE, 4], [BOB, 0]]);

    const buttons = flat(describeBoard(game));

    expect(buttons[4]).toMatchObject({ label: "X", style: "danger", disabled: true });
    expect(buttons[0]).toMatchObject({ label: "O", style: "primary", disabled: true });
    expect(buttons[1]).toMatchObject({ style: "secondary", disabled: false });
  });

  it("turns the winning line green and locks the whole board", () => {
    const game = play(createGame({ x: ALICE, o: BOB }), [[ALICE, 0], [BOB, 3], [ALICE, 1], [BOB, 4], [ALICE, 2]]);

    const buttons = flat(describeBoard(game));

    for (const index of [0, 1, 2]) expect(buttons[index]).toMatchObject({ label: "X", style: "success" });
    expect(buttons[3]).toMatchObject({ label: "O", style: "primary" }); // not part of the line
    expect(buttons.every((button) => button.disabled)).toBe(true); // empty squares too
  });

  it("locks the whole board after a resignation", () => {
    const game = resign(createGame({ x: ALICE, o: BOB }), ALICE).game;
    expect(flat(describeBoard(game)).every((button) => button.disabled)).toBe(true);
  });
});

describe("the text", () => {
  it("names both players and whose turn it is", () => {
    const { content } = describeBoard(createGame({ x: ALICE, o: BOB }));
    expect(content).toBe("**X** <@100>  vs  **O** <@200>\n<@100>'s turn (X)");
  });

  it("describes the computer with its level", () => {
    const { content } = describeBoard(createGame({ x: ALICE, o: COMPUTER, level: "medium" }));
    expect(content).toBe("**X** <@100>  vs  **O** the computer (medium)\n<@100>'s turn (X)");
  });

  it("announces a win and shows the score", () => {
    const game = play(createGame({ x: ALICE, o: BOB }), [[ALICE, 0], [BOB, 3], [ALICE, 1], [BOB, 4], [ALICE, 2]]);

    const { content } = describeBoard(game);

    expect(content).toBe("**X** <@100>  vs  **O** <@200>\n🎉 <@100> wins!\nScore: X 1 · O 0 · draws 0");
  });

  it("announces a draw", () => {
    const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8].map((index, turn) => [turn % 2 === 0 ? ALICE : BOB, index]);

    const { content } = describeBoard(play(createGame({ x: ALICE, o: BOB }), moves));

    expect(content).toContain("It's a draw.");
    expect(content).toContain("draws 1");
  });
});

describe("the controls under the board", () => {
  it("offers Resign while the round is going", () => {
    const { controls } = describeBoard(createGame({ x: ALICE, o: BOB }));
    expect(controls).toEqual([{ customId: "ttt:resign", label: "Resign", style: "secondary", disabled: false }]);
  });

  it("offers Play again once the round is over", () => {
    const game = resign(createGame({ x: ALICE, o: BOB }), ALICE).game;
    const { controls } = describeBoard(game);
    expect(controls).toEqual([{ customId: "ttt:rematch", label: "Play again", style: "success", disabled: false }]);
  });

  it("says who resigned", () => {
    const game = resign(createGame({ x: ALICE, o: BOB }), ALICE).game;
    expect(describeBoard(game).content).toContain("🏳️ <@100> resigned.\n🎉 <@200> wins!");
  });
});
