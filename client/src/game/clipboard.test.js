import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { copyText } from "./clipboard.js";

// Node has no browser, so these tests build a tiny fake page.
function setupPage({ secure, clipboard, execCommand }) {
  const textareas = [];
  const document = {
    createElement: () => {
      const field = {
        value: "",
        attributes: {},
        style: {},
        removed: false,
        selected: false,
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() {},
        select() { this.selected = true; },
        setSelectionRange() {},
        remove() { this.removed = true; },
      };
      textareas.push(field);
      return field;
    },
    body: { appendChild: vi.fn() },
    execCommand,
  };
  vi.stubGlobal("window", { isSecureContext: secure });
  vi.stubGlobal("navigator", clipboard ? { clipboard } : {});
  vi.stubGlobal("document", document);
  return { textareas, document };
}

afterEach(() => vi.unstubAllGlobals());

describe("copyText on a secure page (https or localhost)", () => {
  it("uses the clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue();
    const execCommand = vi.fn();
    setupPage({ secure: true, clipboard: { writeText }, execCommand });
    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to the old way if the clipboard API refuses", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const execCommand = vi.fn().mockReturnValue(true);
    const { textareas } = setupPage({ secure: true, clipboard: { writeText }, execCommand });
    expect(await copyText("hello")).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(textareas[0].value).toBe("hello");
  });
});

describe("copyText on a plain http:// page (like a LAN address)", () => {
  let execCommand;
  beforeEach(() => {
    execCommand = vi.fn().mockReturnValue(true);
  });

  it("works even though navigator.clipboard does not exist", async () => {
    const { textareas } = setupPage({ secure: false, clipboard: undefined, execCommand });
    expect(await copyText("http://192.168.1.20:5173/?room=ABCD")).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(textareas[0].value).toBe("http://192.168.1.20:5173/?room=ABCD");
    expect(textareas[0].selected).toBe(true);
  });

  it("does not touch navigator.clipboard when the page is not secure", async () => {
    const writeText = vi.fn();
    setupPage({ secure: false, clipboard: { writeText }, execCommand });
    await copyText("x");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("uses a hidden, read-only field and always removes it afterwards", async () => {
    const { textareas } = setupPage({ secure: false, clipboard: undefined, execCommand });
    await copyText("x");
    expect(textareas[0].attributes.readonly).toBe("");
    expect(textareas[0].attributes["aria-hidden"]).toBe("true");
    expect(textareas[0].removed).toBe(true);
  });

  it("returns false when the browser refuses to copy", async () => {
    const { textareas } = setupPage({ secure: false, clipboard: undefined, execCommand: vi.fn().mockReturnValue(false) });
    expect(await copyText("x")).toBe(false);
    expect(textareas[0].removed).toBe(true);
  });

  it("returns false (and cleans up) if copying throws", async () => {
    const { textareas } = setupPage({
      secure: false,
      clipboard: undefined,
      execCommand: vi.fn(() => { throw new Error("nope"); }),
    });
    expect(await copyText("x")).toBe(false);
    expect(textareas[0].removed).toBe(true);
  });
});
