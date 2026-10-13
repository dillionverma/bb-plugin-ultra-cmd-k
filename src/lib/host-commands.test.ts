import { describe, expect, it } from "vitest";
import { codeForKey, findBinding, formatShortcut, keyboardEventInit, relayBinding } from "@/lib/host-commands";
import type { Keybinding } from "@/lib/contract";

function binding(overrides: Partial<Keybinding> & { command: string }): Keybinding {
  return {
    desktopOnly: false,
    shortcut: { key: ",", mod: true, meta: false, control: false, alt: false, shift: false },
    when: { all: ["mainSurface"], none: ["modalOpen"] },
    ...overrides,
  };
}

describe("keyboardEventInit", () => {
  it("maps mod to meta on mac and ctrl elsewhere", () => {
    const shortcut = { key: "p", mod: true, meta: false, control: false, alt: false, shift: true };
    expect(keyboardEventInit(shortcut, true)).toMatchObject({ key: "P", code: "KeyP", metaKey: true, ctrlKey: false, shiftKey: true });
    expect(keyboardEventInit(shortcut, false)).toMatchObject({ key: "P", code: "KeyP", metaKey: false, ctrlKey: true, shiftKey: true });
  });
  it("derives codes for punctuation and digits", () => {
    expect(codeForKey(",")).toBe("Comma");
    expect(codeForKey("\\")).toBe("Backslash");
    expect(codeForKey("3")).toBe("Digit3");
    expect(codeForKey("Enter")).toBe("Enter");
  });
});

describe("findBinding", () => {
  it("prefers the desktop-only row on desktop and ignores it on web", () => {
    const web = binding({ command: "thread.new", shortcut: { key: "o", mod: true, meta: false, control: false, alt: false, shift: true } });
    const desktop = binding({ command: "thread.new", desktopOnly: true, shortcut: { key: "n", mod: true, meta: false, control: false, alt: false, shift: false } });
    expect(findBinding([web, desktop], "thread.new")).toBe(web);
    (window as { bbDesktop?: unknown }).bbDesktop = {};
    try {
      expect(findBinding([web, desktop], "thread.new")).toBe(desktop);
    } finally {
      delete (window as { bbDesktop?: unknown }).bbDesktop;
    }
  });
  it("returns null for unbound commands", () => {
    expect(findBinding([binding({ command: "settings.open", shortcut: null })], "settings.open")).toBeNull();
  });
});

describe("relayBinding", () => {
  it("dispatches a bubbling keydown on body and reports whether it was handled", () => {
    const seen: KeyboardEvent[] = [];
    const listener = (event: Event) => {
      seen.push(event as KeyboardEvent);
      if ((event as KeyboardEvent).metaKey && (event as KeyboardEvent).key === ",") event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    try {
      expect(relayBinding(binding({ command: "settings.open" }), true)).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0]!.target).toBe(document.body);
      expect(relayBinding(binding({ command: "x", shortcut: { key: "z", mod: true, meta: false, control: false, alt: false, shift: false } }), true)).toBe(false);
    } finally {
      window.removeEventListener("keydown", listener);
    }
  });
});

describe("formatShortcut", () => {
  it("renders glyphs on mac and words elsewhere", () => {
    const shortcut = { key: "p", mod: true, meta: false, control: false, alt: false, shift: true };
    expect(formatShortcut(shortcut, true)).toEqual(["⇧", "⌘", "P"]);
    expect(formatShortcut(shortcut, false)).toEqual(["Shift", "Ctrl", "P"]);
    expect(formatShortcut({ ...shortcut, key: "Enter", shift: false }, true)).toEqual(["⌘", "↵"]);
  });
});
