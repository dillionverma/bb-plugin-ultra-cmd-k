import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import type { RunResult } from "@/lib/contract";

export function OutputPage({ title, result }: { title: string; result: RunResult }) {
  const api = usePaletteApi();
  const body = [result.stdout, result.stderr].filter((part) => part.trim() !== "").join("\n");
  const status =
    result.code === 0 ? "ok" : result.code === null ? "failed to run" : `exit ${result.code}`;
  return (
    <>
      <CommandGroup heading={`${title} — ${status} in ${result.durationMs}ms${result.truncated ? " (truncated)" : ""}`}>
        <PaletteRow
          value="output:copy"
          keywords={["copy"]}
          icon="Copy"
          title="Copy output"
          onSelect={async () => {
            await navigator.clipboard.writeText(body);
            toast.success("Copied");
          }}
        />
        <PaletteRow
          value="output:again"
          keywords={["rerun", "again"]}
          icon="Repeat"
          title="Run another command"
          onSelect={() => api.replace({ kind: "cli" })}
        />
      </CommandGroup>
      <pre className="mx-2 mb-2 max-h-72 overflow-auto rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {body === "" ? "(no output)" : body}
      </pre>
    </>
  );
}
