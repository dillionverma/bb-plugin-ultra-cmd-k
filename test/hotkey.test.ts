import { describe, expect, it } from "vitest";
import { isModEnter, isPaletteHotkey, type KeyLike } from "@/lib/hotkey";

function key(overrides: Partial<KeyLike>): KeyLike {
  return {
    code: "KeyK",
    key: "k",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...overrides,
  };
}

describe("isPaletteHotkey", () => {
  it("matches Cmd+K on mac and Ctrl+K elsewhere", () => {
    expect(isPaletteHotkey(key({ metaKey: true }), true)).toBe(true);
    expect(isPaletteHotkey(key({ ctrlKey: true }), false)).toBe(true);
  });
  it("rejects the other platform's modifier", () => {
    expect(isPaletteHotkey(key({ ctrlKey: true }), true)).toBe(false);
    expect(isPaletteHotkey(key({ metaKey: true }), false)).toBe(false);
  });
  it("rejects shift/alt, repeats, and IME composition", () => {
    expect(isPaletteHotkey(key({ metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isPaletteHotkey(key({ metaKey: true, altKey: true }), true)).toBe(false);
    expect(isPaletteHotkey(key({ metaKey: true, repeat: true }), true)).toBe(false);
    expect(isPaletteHotkey(key({ metaKey: true, isComposing: true }), true)).toBe(false);
  });
  it("uses the physical key so non-QWERTY layouts still work", () => {
    expect(isPaletteHotkey(key({ metaKey: true, key: "л", code: "KeyK" }), true)).toBe(true);
  });
});

describe("isModEnter", () => {
  it("matches Cmd+Enter on mac only", () => {
    expect(isModEnter(key({ key: "Enter", code: "Enter", metaKey: true }), true)).toBe(true);
    expect(isModEnter(key({ key: "Enter", code: "Enter", ctrlKey: true }), true)).toBe(false);
  });
});
