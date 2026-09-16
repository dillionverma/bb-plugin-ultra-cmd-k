import { describe, expect, it } from "vitest";
import { scoreMatch } from "@/lib/fuzzy";

describe("scoreMatch", () => {
  it("ranks prefix, word-boundary, and mid-word substrings in that order", () => {
    const prefix = scoreMatch("Dracula Dark, high-contrast", "dracula");
    const boundary = scoreMatch("Theme: Dracula", "dracula");
    const mid = scoreMatch("xdraculax", "dracula");
    expect(prefix).toBeGreaterThan(boundary);
    expect(boundary).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
  });
  it("does not match a loose subsequence", () => {
    expect(scoreMatch("Overnight COPS audit — bugs, tests, draft PRs cops", "dracula")).toBe(0);
    expect(scoreMatch("Toggle model picker Open the provider / model / reasoning menu.", "theme")).toBe(0);
    expect(scoreMatch("Focus composer Jump to the message editor. prompt input", "theme")).toBe(0);
  });
  it("still forgives a small typo", () => {
    expect(scoreMatch("Open Settings General, appearance, keyboard", "setings")).toBeGreaterThan(0);
  });
  it("matches every word in any order", () => {
    expect(scoreMatch("Open Settings General, appearance", "settings open")).toBeGreaterThan(0.7);
  });
  it("treats an empty query as a match", () => {
    expect(scoreMatch("anything", "  ")).toBe(1);
  });
});
