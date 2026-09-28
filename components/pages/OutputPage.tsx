import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { StatusIcon } from "@/components/StatusIcon";
import { usePaletteApi } from "@/components/PaletteContext";
import type { RunResult } from "@/lib/contract";
import { GLYPHS } from "@/lib/glyphs";

export function OutputPage({ title, result }: { title: string; result: RunResult }) {
  const api = usePaletteApi();
  const body = [result.stdout, result.stderr].filter((part) => part.trim() !== "").join("\n");
  const ok = result.code === 0;
  const status = ok ? "ok" : result.code === null ? "failed to run" : `exit ${result.code}`;
  return (
    <>
      <CommandGroup
        heading={
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon tone={ok ? "done" : "problem"} />
            <span className="truncate">{title}</span>
            <span className="font-normal text-muted-foreground/70">
              {status} · {result.durationMs}ms{result.truncated ? " · truncated" : ""}
            </span>
          </span>
        }
      >
        <PaletteRow
          value="output:copy"
          keywords={["copy"]}
          glyph={GLYPHS.copy}
          title="Copy output"
          onSelect={async () => {
            await navigator.clipboard.writeText(body);
            toast.success("Copied");
          }}
        />
        <PaletteRow
          value="output:again"
          keywords={["rerun", "again", "another"]}
          glyph={GLYPHS.cli}
          title="Run another command"
          onSelect={() => api.replace({ kind: "cli" })}
        />
      </CommandGroup>
      <pre className="mx-2 mb-2 max-h-72 overflow-auto rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {body === "" ? "(no output)" : body}
      </pre>
    </>
  );
}
