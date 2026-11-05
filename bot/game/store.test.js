import { describe, expect, it } from "vitest";
import { createStore } from "./store.js";

// A clock we move by hand.
function setup(idleMs = 1000) {
  const clock = { time: 0 };
  const store = createStore({ idleMs, now: () => clock.time });
  return { store, clock };
}

describe("the store", () => {
  it("works like a Map for get, set, delete and has", () => {
    const { store } = setup();
    store.set("m1", { a: 1 });
    expect(store.get("m1")).toEqual({ a: 1 });
    expect(store.has("m1")).toBe(true);
    expect(store.size).toBe(1);
    store.delete("m1");
    expect(store.get("m1")).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("keeps entries that are still fresh", () => {
    const { store, clock } = setup();
    store.set("m1", { a: 1 });
    clock.time = 1000; // exactly the limit is not "longer than"
    expect(store.takeExpired()).toEqual([]);
    expect(store.has("m1")).toBe(true);
  });

  it("removes and returns entries idle for longer than the limit, with their meta", () => {
    const { store, clock } = setup();
    store.set("m1", { a: 1 }, { channelId: "c1" });
    clock.time = 1001;
    expect(store.takeExpired()).toEqual([{ id: "m1", entry: { a: 1 }, meta: { channelId: "c1" } }]);
    expect(store.has("m1")).toBe(false);
    expect(store.takeExpired()).toEqual([]); // only reported once
  });

  it("a new version of an entry restarts the clock and keeps the meta", () => {
    const { store, clock } = setup();
    store.set("m1", { v: 1 }, { channelId: "c1" });
    clock.time = 900;
    store.set("m1", { v: 2 }); // someone made a move
    clock.time = 1500; // 600 since the move
    expect(store.takeExpired()).toEqual([]);
    clock.time = 1901;
    expect(store.takeExpired()[0]).toMatchObject({ id: "m1", entry: { v: 2 }, meta: { channelId: "c1" } });
  });

  it("reading does not keep an entry alive", () => {
    const { store, clock } = setup();
    store.set("m1", { a: 1 });
    clock.time = 800;
    store.get("m1");
    clock.time = 1001;
    expect(store.takeExpired()).toHaveLength(1);
  });
});

describe("limits", () => {
  const owned = (ownerId) => ({ channelId: "c", ownerId });

  it("allows a person up to maxPerOwner open entries", () => {
    const { store } = setup();
    for (const id of ["a", "b", "c"]) store.set(id, { n: id }, owned("u1"));
    expect(store.canStart("u1")).toEqual({
      ok: false,
      error: "You already have 3 games or challenges open. Finish or resign one first.",
    });
    expect(store.canStart("u2")).toEqual({ ok: true });
  });

  it("does not count entries that are no longer open", () => {
    const clock = { time: 0 };
    const store = createStore({ idleMs: 1000, now: () => clock.time, isOpen: (entry) => !entry.over });
    store.set("a", { over: true }, owned("u1"));
    store.set("b", { over: true }, owned("u1"));
    store.set("c", { over: true }, owned("u1"));
    expect(store.canStart("u1").ok).toBe(true);
  });

  it("refuses everybody once the total is reached", () => {
    const store = createStore({ idleMs: 1000, maxTotal: 2 });
    store.set("a", {}, owned("u1"));
    store.set("b", {}, owned("u2"));
    expect(store.canStart("u3").ok).toBe(false);
  });

  it("lets people start again once idle entries have been removed", () => {
    const { store, clock } = setup();
    for (const id of ["a", "b", "c"]) store.set(id, {}, owned("u1"));
    clock.time = 2000;
    store.takeExpired();
    expect(store.canStart("u1").ok).toBe(true);
  });

  it("some() looks through the entries, and meta() reads what was stored with one", () => {
    const { store } = setup();
    store.set("a", { pending: true, challenger: "x" }, owned("x"));
    expect(store.some((entry) => entry.challenger === "x")).toBe(true);
    expect(store.some((entry) => entry.challenger === "y")).toBe(false);
    expect(store.meta("a")).toEqual({ channelId: "c", ownerId: "x" });
    expect(store.meta("nope")).toBeUndefined();
  });
});
