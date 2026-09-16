import { describe, expect, it } from "vitest";
import { handlers, OUTPUT_LIMIT, truncate, type Runner } from "@/host";

describe("host run_bb", () => {
  it("runs the fixed bb executable with the given args and bounds output", async () => {
    const calls: { file: string; args: string[] }[] = [];
    const exec: Runner = async (file, args) => {
      calls.push({ file, args });
      return { code: 0, stdout: "x".repeat(OUTPUT_LIMIT + 100), stderr: "" };
    };
    const result = await handlers(exec).run_bb({ args: ["status", "--json"] });
    expect(calls).toEqual([{ file: process.env.BB_CLI ?? "bb", args: ["status", "--json"] }]);
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBeLessThan(OUTPUT_LIMIT + 32);
    expect(result.code).toBe(0);
  });

  it("passes through non-zero exit codes and stderr", async () => {
    const exec: Runner = async () => ({ code: 2, stdout: "", stderr: "boom" });
    const result = await handlers(exec).run_bb({ args: ["nope"] });
    expect(result.code).toBe(2);
    expect(result.stderr).toBe("boom");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("hi")).toEqual({ text: "hi", truncated: false });
  });
});
