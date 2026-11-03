import { describe, it, expect } from "vitest";
import {
  CHAT_HISTORY,
  CHAT_MAX,
  addSystemMessage,
  cleanChatText,
  postMessage,
  resultText,
} from "./chat.js";
import { createRoom, getPublicState, joinRoom, leaveRoom, makeMove, markDisconnected } from "../game/room.js";

const ada = { name: "Ada", avatarSeed: "adaseed001" };
const bob = { name: "Bob", avatarSeed: "bobseed001" };

// Ada (X, "pAda") and Bob (O, "pBob") are both seated.
function chatRoom() {
  const room = createRoom();
  joinRoom(room, "pAda", "sAda", ada);
  joinRoom(room, "pBob", "sBob", bob);
  return room;
}

describe("cleanChatText", () => {
  it("leaves an ordinary message alone", () => {
    expect(cleanChatText("Good game!")).toBe("Good game!");
  });

  it("trims, and turns every kind of whitespace into single spaces", () => {
    expect(cleanChatText("  hello   world  ")).toBe("hello world");
    expect(cleanChatText("line one\nline two")).toBe("line one line two");
    expect(cleanChatText("a\t\tb\r\n\r\nc")).toBe("a b c");
  });

  it("removes control, zero-width and direction-override characters", () => {
    expect(cleanChatText("he\u0000llo")).toBe("hello");
    expect(cleanChatText("zero\u200Bwidth")).toBe("zerowidth");
    expect(cleanChatText("\u202Etxet")).toBe("txet");
    expect(cleanChatText("a\u2028b")).toBe("a b");
  });

  it("keeps letters from any language, emoji and markup characters as plain text", () => {
    expect(cleanChatText("こんにちは 😀")).toBe("こんにちは 😀");
    expect(cleanChatText("<b>hi</b> & <script>")).toBe("<b>hi</b> & <script>");
  });

  it("returns an empty string for anything that is not text, or has nothing visible", () => {
    for (const bad of [null, undefined, 42, {}, [], true]) expect(cleanChatText(bad)).toBe("");
    expect(cleanChatText("   \n\t  ")).toBe("");
    expect(cleanChatText("\u200B\u202E")).toBe("");
  });
});

describe("postMessage", () => {
  it("adds a message with the sender taken from their SEAT", () => {
    const room = chatRoom();
    const result = postMessage(room, "pBob", "hi Ada", 1234);
    expect(result.ok).toBe(true);
    expect(result.message).toMatchObject({ seat: "O", name: "Bob", avatarSeed: "bobseed001", text: "hi Ada", at: 1234 });
    expect(room.chat).toEqual([result.message]);
  });

  it("numbers messages in order", () => {
    const room = chatRoom();
    const ids = [1, 2, 3].map(() => postMessage(room, "pAda", "x").message.id);
    expect(ids[1]).toBe(ids[0] + 1);
    expect(ids[2]).toBe(ids[1] + 1);
  });

  it("never contains a player id or a socket id", () => {
    const room = chatRoom();
    postMessage(room, "pAda", "hello");
    addSystemMessage(room, "Bob joined.");
    const json = JSON.stringify(room.chat);
    for (const secret of ["pAda", "pBob", "sAda", "sBob", "playerId", "socketId"]) expect(json).not.toContain(secret);
  });

  it("refuses someone who is not sitting in the room", () => {
    expect(postMessage(chatRoom(), "stranger", "hi")).toEqual({ ok: false, error: "You are not in this room" });
  });

  it("refuses while nobody else is there", () => {
    const room = createRoom();
    joinRoom(room, "pAda", "sAda", ada);
    expect(postMessage(room, "pAda", "hello?").error).toBe("Wait for someone to join first");
    expect(room.chat).toEqual([]);
  });

  it("still works while the other player's connection has dropped (they will read it on return)", () => {
    const room = chatRoom();
    markDisconnected(room, "pBob", "sBob");
    expect(postMessage(room, "pAda", "are you there?").ok).toBe(true);
  });

  it("refuses text that is not text, and empty messages", () => {
    const room = chatRoom();
    for (const bad of [null, undefined, 42, {}, ["hi"], true]) expect(postMessage(room, "pAda", bad).ok).toBe(false);
    for (const empty of ["", "   ", "\n\n", "\u200B"]) expect(postMessage(room, "pAda", empty).error).toBe("Type a message first");
    expect(room.chat).toEqual([]);
  });

  it("allows exactly 200 characters and refuses 201", () => {
    const room = chatRoom();
    expect(CHAT_MAX).toBe(200);
    expect(postMessage(room, "pAda", "a".repeat(200)).ok).toBe(true);
    expect(postMessage(room, "pAda", "a".repeat(201)).error).toMatch(/200 characters/);
  });

  it("counts an emoji as one character, not two", () => {
    const room = chatRoom();
    expect(postMessage(room, "pAda", "😀".repeat(200)).ok).toBe(true);
    expect(postMessage(room, "pAda", "😀".repeat(201)).ok).toBe(false);
  });

  it("refuses a huge message without working on it", () => {
    const start = performance.now();
    expect(postMessage(chatRoom(), "pAda", "x".repeat(5_000_000)).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("stores the CLEANED text", () => {
    const room = chatRoom();
    expect(postMessage(room, "pAda", "  hi\n  there\u200B ").message.text).toBe("hi there");
  });

  it("keeps markup as harmless plain text", () => {
    const room = chatRoom();
    expect(postMessage(room, "pAda", "<img src=x onerror=alert(1)>").message.text).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("history", () => {
  it("remembers only the last 50 messages, newest kept, in order", () => {
    const room = chatRoom();
    expect(CHAT_HISTORY).toBe(50);
    for (let i = 1; i <= 120; i++) postMessage(room, "pAda", `message ${i}`);
    expect(room.chat).toHaveLength(50);
    expect(room.chat[0].text).toBe("message 71");
    expect(room.chat.at(-1).text).toBe("message 120");
    const ids = room.chat.map((m) => m.id);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it("server lines are marked as system lines and have no sender", () => {
    const room = chatRoom();
    const line = addSystemMessage(room, "Bob joined.", 99);
    expect(line).toMatchObject({ system: true, text: "Bob joined.", at: 99 });
    expect(line.seat).toBeUndefined();
    expect(line.name).toBeUndefined();
  });

  it("is not part of the public game state", () => {
    const room = chatRoom();
    postMessage(room, "pAda", "a secret plan");
    const json = JSON.stringify(getPublicState(room));
    expect(json).not.toContain("a secret plan");
    expect(Object.keys(getPublicState(room))).not.toContain("chat");
  });

  it("is kept when the same player leaves and comes back", () => {
    const room = chatRoom();
    postMessage(room, "pAda", "before");
    leaveRoom(room, "pBob");
    joinRoom(room, "pBob", "sBob2", bob);
    expect(room.chat.map((m) => m.text)).toEqual(["before"]);
  });

  it("starts over when a DIFFERENT person takes a seat: the new player never reads the old chat", () => {
    const room = chatRoom();
    postMessage(room, "pAda", "private chat between Ada and Bob");
    leaveRoom(room, "pBob");
    joinRoom(room, "pNew", "sNew", { name: "Newcomer", avatarSeed: "newseed001" });
    expect(room.chat).toEqual([]);
  });

  it("numbering continues after a restart (ids never repeat in a room)", () => {
    const room = chatRoom();
    const before = postMessage(room, "pAda", "one").message.id;
    leaveRoom(room, "pBob");
    joinRoom(room, "pNew", "sNew", ada);
    const roomAfter = addSystemMessage(room, "x");
    expect(roomAfter.id).toBeGreaterThan(before);
  });
});

describe("resultText", () => {
  it("is null while the round is going", () => {
    expect(resultText(chatRoom())).toBeNull();
  });

  it("names the winner", () => {
    const room = chatRoom();
    for (const [id, i] of [["pAda", 0], ["pBob", 3], ["pAda", 1], ["pBob", 4], ["pAda", 2]]) makeMove(room, id, i);
    expect(resultText(room)).toBe("Ada won the round!");
  });

  it("says when it was a draw", () => {
    const room = chatRoom();
    const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8];
    moves.forEach((cell, n) => makeMove(room, n % 2 === 0 ? "pAda" : "pBob", cell));
    expect(resultText(room)).toBe("The round was a draw.");
  });
});
