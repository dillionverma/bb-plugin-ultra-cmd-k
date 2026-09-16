import { useMemo } from "react";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi, useRegisterActions } from "@/components/PaletteContext";
import { ThreadRow, threadTitle } from "@/components/ThreadRow";
import { OPEN_LAUNCHER_EVENT } from "@/lib/launcher";
import type { Action } from "@/lib/palette-types";

export function ProjectPage({ projectId }: { projectId: string }) {
  const api = usePaletteApi();
  const project = api.threads.projects.find((entry) => entry.id === projectId);
  const threads = useMemo(
    () =>
      api.threads.threads
        .filter((thread) => thread.projectId === projectId && !thread.isArchived && thread.parentThreadId === null)
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt)
        .slice(0, 50),
    [api.threads.threads, projectId],
  );
  const actions = useMemo(
    () =>
      threads.map(
        (thread): Action => ({
          id: `thread:${thread.id}:open`,
          title: threadTitle(thread),
          icon: "MessageSquare",
          group: "Threads",
          run: () => {
            api.record("thread:open");
            api.threadActions.open(thread.id);
            api.close();
          },
          secondary: () => {
            api.record("thread:open-split");
            api.threadActions.open(thread.id, { split: true });
            api.close();
          },
          page: { kind: "thread", threadId: thread.id },
        }),
      ),
    [api, threads],
  );
  useRegisterActions(actions);
  if (!project) return null;
  return (
    <>
      <CommandGroup heading={project.name}>
        <PaletteRow
          value={`project:${projectId}:open`}
          keywords={["open", "go to", project.name]}
          icon="Folder"
          title="Open project"
          onSelect={() => {
            api.record("project:open");
            api.nav.toProject(projectId);
            api.close();
          }}
        />
        <PaletteRow
          value={`project:${projectId}:new`}
          keywords={["new thread", "start", project.name]}
          icon="MessageSquarePlus"
          title="New thread here"
          subtitle={api.bootstrap?.launcherInstalled ? "Opens Ultra Launcher" : undefined}
          onSelect={() => {
            api.record("project:new-thread");
            api.close();
            if (api.bootstrap?.launcherInstalled) {
              window.dispatchEvent(new Event(OPEN_LAUNCHER_EVENT));
            } else {
              api.threadActions.openNewThread({ projectId, focusPrompt: true });
            }
          }}
        />
      </CommandGroup>
      {threads.length > 0 ? (
        <CommandGroup heading="Threads">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              project={project}
              showProject={false}
              actionId={`thread:${thread.id}:open`}
              onSelect={() => {
                api.record("thread:open");
                api.threadActions.open(thread.id);
                api.close();
              }}
            />
          ))}
        </CommandGroup>
      ) : null}
    </>
  );
}
