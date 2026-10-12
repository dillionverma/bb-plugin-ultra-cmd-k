// "/" mode: skills available to the current project. Enter starts a new
// thread with the slash command prefilled; Ctrl/Cmd+Enter sends it straight
// to the current thread.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { LoadingRows } from "@/components/LoadingRows";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi, useRegisterActions, type PaletteApi } from "@/components/PaletteContext";
import type { SkillEntry } from "@/lib/contract";
import { GLYPHS } from "@/lib/glyphs";
import type { Action } from "@/lib/palette-types";

const SCOPE_LABEL: Record<string, string> = {
  "bb-builtin": "Built in",
  "bb-project": "Project",
  "bb-user": "Yours",
  "provider-project": "Project (provider)",
  "provider-user": "Yours (provider)",
  "shared-project": "Project (shared)",
  "shared-user": "Yours (shared)",
  plugin: "From plugins",
};

function buildSkillActions(api: PaletteApi, skills: readonly SkillEntry[], threadId: string | null): Action[] {
  return skills.map((skill) => {
    const slash = `/${skill.name}`;
    const id = `skill:${skill.id}`;
    return {
      id,
      title: slash,
      subtitle: skill.description ?? undefined,
      glyph: "skills",
      group: SCOPE_LABEL[skill.scope] ?? skill.scope,
      keywords: [skill.name, skill.description ?? ""],
      run: () => {
        api.record(id);
        api.nav.toCompose({ initialPrompt: `${slash} `, focusPrompt: true });
        api.close();
      },
      ...(threadId
        ? {
            secondary: async () => {
              try {
                await api.rpc.call("send_message", { threadId, text: slash });
                api.record(id);
                toast.success(`Sent ${slash}`);
                api.close();
              } catch (error) {
                api.reportError(error);
              }
            },
          }
        : {}),
    };
  });
}

function Notice({ text }: { text: string }) {
  return (
    <CommandGroup heading="Skills">
      <PaletteRow value={`skills:${text}`} keywords={[]} icon="Info" title={text} disabled onSelect={() => {}} />
    </CommandGroup>
  );
}

export function SkillsPage() {
  const api = usePaletteApi();
  const projectId =
    api.bbContext.projectId ??
    api.threads.projects.find((project) => project.isPersonal)?.id ??
    api.threads.projects[0]?.id ??
    null;
  const threadId = api.bbContext.threadId;
  const currentThread = threadId ? api.threads.threads.find((thread) => thread.id === threadId) : undefined;
  const environmentId = currentThread?.environment?.id ?? null;
  const [skills, setSkills] = useState<SkillEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId === null) return;
    let cancelled = false;
    api.rpc
      .call("list_skills", { projectId, environmentId })
      .then((result) => {
        if (!cancelled) setSkills(result.skills);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [api.rpc, projectId, environmentId]);

  const actions = useMemo(() => buildSkillActions(api, skills ?? [], threadId), [api, skills, threadId]);
  useRegisterActions(actions);

  if (projectId === null) return <Notice text="No project to list skills for" />;
  if (error !== null) return <Notice text={error} />;
  if (skills === null) return <LoadingRows count={5} />;
  if (skills.length === 0) return <Notice text="No skills available in this project" />;

  const groups = new Map<string, Action[]>();
  for (const action of actions) groups.set(action.group, [...(groups.get(action.group) ?? []), action]);
  const secondaryKeys = threadId ? [api.isMac ? "⌘" : "Ctrl", "↵"] : undefined;
  return (
    <>
      {[...groups.entries()].map(([label, entries]) => (
        <CommandGroup key={label} heading={label}>
          {entries.map((action) => (
            <PaletteRow
              key={action.id}
              value={action.id}
              data-action-id={action.id}
              keywords={[action.title, ...(action.keywords ?? [])]}
              glyph={GLYPHS.skills}
              title={action.title}
              meta={action.subtitle}
              shortcut={secondaryKeys}
              onSelect={() => void action.run()}
            />
          ))}
        </CommandGroup>
      ))}
    </>
  );
}
