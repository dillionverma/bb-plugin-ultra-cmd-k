// Theme picker with live preview: moving the highlight applies the theme
// (debounced) the way Settings → Appearance previews on hover; Enter commits,
// leaving the page without committing restores the original.
import { useEffect, useRef, useState } from "react";
import { useCommandState } from "cmdk";
import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import type { ThemeEntry } from "@/lib/contract";

const PREVIEW_DELAY_MS = 120;
const KIND_LABEL: Record<ThemeEntry["kind"], string> = {
  builtin: "Built-in",
  custom: "Custom",
  plugin: "From plugins",
};

function ThemePreview({ original, onApply }: { original: string; onApply: (themeId: string) => Promise<void> }) {
  const highlighted = useCommandState((state) => state.value);
  const committed = useRef(false);
  const applied = useRef(original);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!highlighted.startsWith("theme:")) return;
    const themeId = highlighted.slice("theme:".length);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (applied.current === themeId) return;
      applied.current = themeId;
      void onApply(themeId);
    }, PREVIEW_DELAY_MS);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [highlighted, onApply]);

  // Leaving without committing puts the original palette back.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (!committed.current && applied.current !== original) void onApply(original);
    },
    [onApply, original],
  );

  useEffect(() => {
    const commit = () => {
      committed.current = true;
    };
    window.addEventListener("ultra-cmd-k:theme-committed", commit);
    return () => window.removeEventListener("ultra-cmd-k:theme-committed", commit);
  }, []);
  return null;
}

export function ThemesPage() {
  const api = usePaletteApi();
  const theme = api.bootstrap?.theme ?? null;
  const [original] = useState(() => theme?.activeId ?? "default");

  if (theme === null) return null;
  const apply = async (themeId: string) => {
    try {
      await api.rpc.call("set_theme", { themeId });
    } catch (error) {
      api.reportError(error);
    }
  };
  const groups = (["builtin", "custom", "plugin"] as const)
    .map((kind) => ({ kind, entries: theme.entries.filter((entry) => entry.kind === kind) }))
    .filter((group) => group.entries.length > 0);

  return (
    <>
      <ThemePreview original={original} onApply={apply} />
      {groups.map((group) => (
        <CommandGroup key={group.kind} heading={KIND_LABEL[group.kind]}>
          {group.entries.map((entry) => (
            <PaletteRow
              key={entry.id}
              value={`theme:${entry.id}`}
              keywords={[entry.name, entry.id, entry.description ?? ""]}
              icon="Palette"
              title={entry.name}
              subtitle={entry.description}
              active={entry.id === theme.activeId}
              onSelect={async () => {
                window.dispatchEvent(new Event("ultra-cmd-k:theme-committed"));
                await apply(entry.id);
                api.record(`theme:${entry.id}`);
                await api.refreshBootstrap();
                toast.success(`Theme: ${entry.name}`);
                api.close();
              }}
            />
          ))}
        </CommandGroup>
      ))}
    </>
  );
}
