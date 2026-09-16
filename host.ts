// bb-plugin-ultra-cmd-k — host-daemon entry.
//
// The server process cannot spawn processes; this entry runs on the enrolled
// host and executes the `bb` CLI for the palette's "$" mode. The executable is
// fixed (no shell, no PATH lookup of user input), arguments are validated by
// the shared contract, and output is bounded so a chatty command can never
// flood the RPC channel.
import { execFile } from "node:child_process";
import { experimental_defineHostEntry } from "@get-bb/plugin-sdk";
import { hostContract, type RunResult } from "./lib/contract";

export const OUTPUT_LIMIT = 64 * 1024;
export const RUN_TIMEOUT_MS = 30_000;

export function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= OUTPUT_LIMIT) return { text, truncated: false };
  return { text: `${text.slice(0, OUTPUT_LIMIT)}\n… [truncated]`, truncated: true };
}

export type Runner = (
  file: string,
  args: string[],
) => Promise<{ code: number | null; stdout: string; stderr: string }>;

export const run: Runner = (file, args) =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        timeout: RUN_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      },
      (error, stdout, stderr) => {
        if (error && !("code" in error && typeof error.code === "number")) {
          // Spawn failure (ENOENT, timeout) rather than a non-zero exit.
          resolve({ code: null, stdout: String(stdout), stderr: `${String(stderr)}\n${error.message}`.trim() });
          return;
        }
        resolve({
          code: error && typeof error.code === "number" ? error.code : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      },
    );
  });

export function handlers(exec: Runner = run) {
  return {
    async run_bb({ args }: { args: string[] }): Promise<RunResult> {
      const started = Date.now();
      const executable = process.env.BB_CLI ?? "bb";
      const result = await exec(executable, args);
      const stdout = truncate(result.stdout);
      const stderr = truncate(result.stderr);
      return {
        code: result.code,
        stdout: stdout.text,
        stderr: stderr.text,
        truncated: stdout.truncated || stderr.truncated,
        durationMs: Date.now() - started,
      };
    },
  };
}

export default experimental_defineHostEntry({ contract: hostContract, handlers: handlers() });
