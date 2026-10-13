// Theme picker. Preview-on-highlight is handled by <ThemePreview/> in the
// palette shell, so this page only lists rows.
import { useMemo } from "react";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi, useRegisterActions } from "@/components/PaletteContext";
import { ThemeDot } from "@/components/ThemeDot";
import { themeAction } from "@/lib/actions";
import type { ThemeEntry } from "@/lib/contract";

const KIND_LABEL: Record<ThemeEntry["kind"], string> = {
  builtin: "Built in",
  custom: "Your themes",
  plugin: "From plugins",
};

export function ThemesPage() {
  const api = usePaletteApi();
  const theme = api.bootstrap?.theme ?? null;
  const actions = useMemo(
    () => (theme ? theme.entries.map((entry) => themeAction(api, entry, KIND_LABEL[entry.kind])) : []),
    [api, theme],
  );
  useRegisterActions(actions);
  if (theme === null) return null;

  const groups = (["builtin", "custom", "plugin"] as const)
    .map((kind) => ({ kind, entries: theme.entries.filter((entry) => entry.kind === kind) }))
    .filter((group) => group.entries.length > 0);

  return (
    <>
      {groups.map((group) => (
        <CommandGroup key={group.kind} heading={KIND_LABEL[group.kind]}>
          {group.entries.map((entry) => {
            const action = actions.find((candidate) => candidate.id === `theme:${entry.id}`)!;
            return (
              <PaletteRow
                key={entry.id}
                value={action.id}
                data-action-id={action.id}
                keywords={[entry.name, entry.id, entry.description ?? ""]}
                iconNode={<ThemeDot swatch={entry.swatch} />}
                title={entry.name}
                meta={entry.description ?? undefined}
                active={action.active}
                onSelect={() => void action.run()}
              />
            );
          })}
        </CommandGroup>
      ))}
    </>
  );
}
