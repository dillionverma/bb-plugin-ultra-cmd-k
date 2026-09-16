import { describe, expect, it } from "vitest";
import { splitArgs } from "@/components/pages/CliPage";
import { bbArgsSchema, MAX_BB_ARGS } from "@/lib/contract";

describe("splitArgs", () => {
  it("splits on whitespace and honours quotes", () => {
    expect(splitArgs("thread list --limit 5")).toEqual(["thread", "list", "--limit", "5"]);
    expect(splitArgs(`thread message "hello world" --json`)).toEqual(["thread", "message", "hello world", "--json"]);
    expect(splitArgs("theme set 'top center'")).toEqual(["theme", "set", "top center"]);
    expect(splitArgs("  ")).toEqual([]);
    expect(splitArgs('say ""')).toEqual(["say", ""]);
  });
});

describe("bbArgsSchema", () => {
  it("accepts ordinary argument lists", () => {
    expect(bbArgsSchema.safeParse(["status", "--json"]).success).toBe(true);
  });
  it("rejects empty, oversized, and newline-bearing input", () => {
    expect(bbArgsSchema.safeParse([]).success).toBe(false);
    expect(bbArgsSchema.safeParse(Array.from({ length: MAX_BB_ARGS + 1 }, () => "x")).success).toBe(false);
    expect(bbArgsSchema.safeParse(["thread", "list\nrm -rf /"]).success).toBe(false);
  });
});
