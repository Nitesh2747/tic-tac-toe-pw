import { describe, it, expect } from "vitest";
import { CHAT_HISTORY, appendMessage, countUnread, formatTime } from "./chat.js";

const msg = (id, extra = {}) => ({ id, seat: "O", name: "Bob", text: `m${id}`, at: 0, ...extra });

describe("appendMessage", () => {
  it("adds a message to the end, without changing the list it was given", () => {
    const list = [msg(1)];
    const next = appendMessage(list, msg(2));
    expect(next.map((m) => m.id)).toEqual([1, 2]);
    expect(list).toHaveLength(1);
  });

  it("ignores a message it already has (the same id)", () => {
    const list = [msg(1), msg(2)];
    expect(appendMessage(list, msg(2))).toBe(list);
  });

  it("keeps only the newest 50", () => {
    let list = [];
    for (let i = 1; i <= 80; i++) list = appendMessage(list, msg(i));
    expect(CHAT_HISTORY).toBe(50);
    expect(list).toHaveLength(50);
    expect(list[0].id).toBe(31);
    expect(list.at(-1).id).toBe(80);
  });
});

describe("countUnread", () => {
  const list = [
    msg(1, { seat: "O" }),
    msg(2, { seat: "X" }),
    msg(3, { system: true, seat: undefined }),
    msg(4, { seat: "O" }),
  ];

  it("counts only the other player's messages newer than the last one seen", () => {
    expect(countUnread(list, 0, "X")).toBe(2); // ids 1 and 4 (not mine, not system)
    expect(countUnread(list, 1, "X")).toBe(1);
    expect(countUnread(list, 4, "X")).toBe(0);
  });

  it("never counts my own messages, or server lines", () => {
    expect(countUnread(list, 0, "O")).toBe(1); // only id 2 is from X
    expect(countUnread([msg(9, { system: true })], 0, "X")).toBe(0);
  });

  it("is zero for an empty chat", () => {
    expect(countUnread([], 0, "X")).toBe(0);
  });
});

describe("formatTime", () => {
  it("shows hours and minutes", () => {
    expect(formatTime(new Date(2026, 9, 24, 14, 5).getTime(), "en-GB")).toBe("14:05");
  });
  it("pads single digits", () => {
    expect(formatTime(new Date(2026, 9, 24, 9, 7).getTime(), "en-GB")).toBe("09:07");
  });
});
