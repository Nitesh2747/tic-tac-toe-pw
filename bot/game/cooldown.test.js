import { describe, expect, it } from "vitest";
import { createCooldown, noCooldown } from "./cooldown.js";

describe("cooldown", () => {
  const setup = (ms = 1000) => {
    const clock = { time: 0 };
    return { cooldown: createCooldown({ ms, now: () => clock.time }), clock };
  };

  it("lets the first go ahead, then says how long to wait", () => {
    const { cooldown, clock } = setup();
    expect(cooldown.use("a")).toBe(0);
    clock.time = 300;
    expect(cooldown.use("a")).toBe(700);
  });

  it("lets them go ahead again once the wait is over", () => {
    const { cooldown, clock } = setup();
    cooldown.use("a");
    clock.time = 1000;
    expect(cooldown.use("a")).toBe(0);
  });

  it("a refused try does not extend the wait", () => {
    const { cooldown, clock } = setup();
    cooldown.use("a");
    clock.time = 900;
    cooldown.use("a"); // refused
    clock.time = 1000;
    expect(cooldown.use("a")).toBe(0);
  });

  it("people wait separately", () => {
    const { cooldown } = setup();
    cooldown.use("a");
    expect(cooldown.use("b")).toBe(0);
  });

  it("forgets finished waits so the table cannot grow forever", () => {
    const clock = { time: 0 };
    const cooldown = createCooldown({ ms: 1000, now: () => clock.time, maxKeys: 3 });
    for (const key of ["a", "b", "c"]) cooldown.use(key);
    clock.time = 2000;
    cooldown.use("d"); // 4 keys: over the limit, so the finished waits are dropped
    expect(cooldown.size).toBe(1);
  });

  it("noCooldown never makes anyone wait", () => {
    expect(noCooldown.use("a")).toBe(0);
    expect(noCooldown.use("a")).toBe(0);
  });
});
