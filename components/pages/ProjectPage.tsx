import { useMemo } from "react";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { ProjectIcon } from "@/components/ProjectIcon";
import { usePaletteApi, useRegisterActions } from "@/components/PaletteContext";
import { ThreadRow } from "@/components/ThreadRow";
import { isListedThread, sortThreads, threadOpenAction } from "@/lib/actions";
import { GLYPHS } from "@/lib/glyphs";
import { OPEN_LAUNCHER_EVENT } from "@/lib/launcher";

const PROJECT_THREAD_CAP = 50;

export function ProjectPage({ projectId }: { projectId: string }) {
  const api = usePaletteApi();
  const project = api.threads.projects.find((entry) => entry.id === projectId);
  const threads = useMemo(
    () => sortThreads(api.threads.threads.filter((thread) => thread.projectId === projectId && isListedThread(thread))).slice(0, PROJECT_THREAD_CAP),
    [api.threads.threads, projectId],
  );
  const actions = useMemo(() => threads.map((thread) => threadOpenAction(api, thread)), [api, threads]);
  useRegisterActions(actions);
  if (!project) return null;
  return (
    <>
      <CommandGroup
        heading={
          <span className="inline-flex items-center gap-1.5">
            <ProjectIcon projectId={project.id} isPersonal={project.isPersonal} className="size-3.5" />
            {project.name}
          </span>
        }
      >
        <PaletteRow
          value={`project:${projectId}:open`}
          keywords={["open", "go to", project.name]}
          glyph={GLYPHS.open}
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
          glyph={GLYPHS.newThread}
          title="New thread here"
          meta={api.bootstrap?.launcherInstalled ? "Ultra Launcher" : undefined}
          onSelect={() => {
            api.record("project:new-thread");
            api.close();
            if (api.bootstrap?.launcherInstalled) window.dispatchEvent(new Event(OPEN_LAUNCHER_EVENT));
            else api.threadActions.openNewThread({ projectId, focusPrompt: true });
          }}
        />
      </CommandGroup>
      {threads.length > 0 ? (
        <CommandGroup heading="Threads">
          {threads.map((thread, index) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              project={project}
              showProject={false}
              actionId={actions[index]!.id}
              onSelect={() => void actions[index]!.run()}
            />
          ))}
        </CommandGroup>
      ) : null}
    </>
  );
}
