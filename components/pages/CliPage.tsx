// "$" mode: run any `bb …` command on the primary host. The executable is
// fixed server-side; only arguments travel. Output opens in a page so the
// palette never has to close to show a result.
import { useState } from "react";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import { MAX_BB_ARGS } from "@/lib/contract";

/** Shell-ish split: whitespace separated, "double" and 'single' quotes group. */
export function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasToken = false;
  for (const char of input) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (hasToken) {
        args.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }
    current += char;
    hasToken = true;
  }
  if (hasToken) args.push(current);
  return args;
}

const SUGGESTIONS: { args: string; summary: string }[] = [
  { args: "status", summary: "Current project, thread and environment" },
  { args: "thread list", summary: "Recent threads" },
  { args: "plugin list", summary: "Installed plugins and their state" },
  { args: "theme list", summary: "Available themes" },
  { args: "settings keyboard list", summary: "Effective keybindings" },
  { args: "automation list", summary: "Scheduled work" },
  { args: "workflows list", summary: "Workflow runs" },
];

export function CliPage({ text, setQuery }: { text: string; setQuery: (value: string) => void }) {
  const api = usePaletteApi();
  const [running, setRunning] = useState(false);
  const args = splitArgs(text.startsWith("bb ") ? text.slice(3) : text);
  const valid = args.length > 0 && args.length <= MAX_BB_ARGS;
  const command = `bb ${args.join(" ")}`.trim();
  const hostName = api.bootstrap?.hosts.find((host) => host.id === api.bootstrap?.primaryHostId)?.name;

  const run = async () => {
    if (!valid || running) return;
    setRunning(true);
    try {
      const result = await api.rpc.call("run_bb", { args });
      api.record("cli:run");
      api.push({ kind: "output", title: command, result });
    } catch (error) {
      api.reportError(error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <CommandGroup heading={hostName ? `Run on ${hostName}` : "Run"}>
        <PaletteRow
          value="cli:run"
          keywords={[]}
          icon={running ? "Loading" : "Terminal"}
          title={valid ? command : "Type bb arguments, e.g. thread list"}
          subtitle={running ? "Running…" : undefined}
          disabled={!valid || running}
          shortcut={["↵"]}
          onSelect={run}
        />
      </CommandGroup>
      {text.trim() === "" ? (
        <CommandGroup heading="Suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <PaletteRow
              key={suggestion.args}
              value={`cli:suggest:${suggestion.args}`}
              keywords={[suggestion.args, suggestion.summary]}
              icon="ChevronRight"
              title={`bb ${suggestion.args}`}
              subtitle={suggestion.summary}
              onSelect={() => setQuery(`$ ${suggestion.args}`)}
            />
          ))}
        </CommandGroup>
      ) : null}
    </>
  );
}
