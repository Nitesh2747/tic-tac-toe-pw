import { describe, expect, it } from "vitest";
import { createConnectionCounter } from "./connectionLimit.js";

describe("connection counter", () => {
  it("counts per address", () => {
    const counter = createConnectionCounter();
    counter.add("1.1.1.1");
    counter.add("1.1.1.1");
    counter.add("2.2.2.2");
    expect(counter.count("1.1.1.1")).toBe(2);
    expect(counter.count("2.2.2.2")).toBe(1);
    expect(counter.count("3.3.3.3")).toBe(0);
  });

  it("forgets an address once its last connection closes", () => {
    const counter = createConnectionCounter();
    counter.add("1.1.1.1");
    counter.add("1.1.1.1");
    counter.remove("1.1.1.1");
    expect(counter.count("1.1.1.1")).toBe(1);
    counter.remove("1.1.1.1");
    expect(counter.size).toBe(0);
  });

  it("never goes negative", () => {
    const counter = createConnectionCounter();
    counter.remove("9.9.9.9");
    expect(counter.count("9.9.9.9")).toBe(0);
    expect(counter.size).toBe(0);
  });
});
