// The root list: recents, this thread's actions, threads, projects,
// appearance, entry points, and every host command with a binding.
import { useCallback, useDeferredValue, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { CommandGroup } from "@/components/ui/command";
import { LoadingRows } from "@/components/LoadingRows";
import { PaletteRow } from "@/components/PaletteRow";
import { ProjectIcon } from "@/components/ProjectIcon";
import { ThemeDot } from "@/components/ThemeDot";
import { ThreadRow } from "@/components/ThreadRow";
import { VirtualThreadList } from "@/components/VirtualThreadList";
import { FaviconDot } from "@/components/pages/FaviconPage";
import { usePaletteApi, useRegisterActions, type PaletteApi } from "@/components/PaletteContext";
import { isListedThread, sortThreads, startNewThread, themeAction, threadOpenAction } from "@/lib/actions";
import { APPEARANCE_MODES, readAppearanceMode, writeAppearanceMode, type AppearanceMode } from "@/lib/appearance";
import { GLYPHS } from "@/lib/glyphs";
import { findBinding, formatShortcut, HOST_COMMANDS } from "@/lib/host-commands";
import { GROUP_ORDER, type Action, type PrefixMode } from "@/lib/palette-types";
import { rank, recentsStore } from "@/lib/recents";
import { rankThreads } from "@/lib/thread-search";

/** Threads shown in the root list before you type. */
const ROOT_THREAD_CAP = 8;
/** Best thread matches shown among a root search's commands and themes; `@` mode has no cap. */
const SEARCH_THREAD_CAP = 50;
const RECENT_CAP = 5;
const COMMAND_GROUPS = GROUP_ORDER.filter((group) => !["Recent", "Threads", "Projects"].includes(group));

const MODE_LABEL: Record<AppearanceMode, string> = { light: "Light mode", dark: "Dark mode", system: "Match system" };
const MODE_GLYPH: Record<AppearanceMode, Action["glyph"]> = { light: "light", dark: "dark", system: "system" };

function newThread(api: PaletteApi): Action {
  const launcher = api.bootstrap?.launcherRunning === true;
  return {
    id: "new-thread",
    title: "New thread",
    subtitle: launcher ? "Ultra Launcher" : undefined,
    glyph: "newThread",
    group: "Agent & CLI",
    keywords: ["create", "start", "compose", "cmd+n", "launcher"],
    run: () => {
      api.record("new-thread");
      startNewThread(api, api.bbContext.projectId ?? undefined);
    },
  };
}

function appearanceActions(api: PaletteApi, current: AppearanceMode): Action[] {
  const theme = api.bootstrap?.theme;
  const activeTheme = theme?.entries.find((entry) => entry.id === theme.activeId);
  return [
    {
      id: "theme:pick",
      title: "Change theme",
      subtitle: activeTheme?.name ?? theme?.activeId,
      glyph: "theme",
      group: "Appearance",
      keywords: ["theme", "themes", "palette", "colors", "color scheme", "skin"],
      run: () => api.push({ kind: "themes" }),
      page: { kind: "themes" },
    },
    ...APPEARANCE_MODES.map(
      (mode): Action => ({
        id: `appearance:${mode}`,
        title: MODE_LABEL[mode],
        glyph: MODE_GLYPH[mode],
        group: "Appearance",
        keywords: ["appearance", "light", "dark", "system", "mode", "night", "day", mode],
        active: mode === current,
        run: () => {
          writeAppearanceMode(mode);
          api.record(`appearance:${mode}`);
          toast.success(MODE_LABEL[mode]);
          api.close();
        },
      }),
    ),
    {
      id: "favicon:pick",
      title: "Favicon color",
      subtitle: theme?.faviconColor === "default" ? undefined : theme?.faviconColor,
      glyph: "favicon",
      group: "Appearance",
      keywords: ["favicon", "tab icon", "dock icon", "color"],
      run: () => api.push({ kind: "favicon" }),
      page: { kind: "favicon" },
    },
  ];
}

function agentActions(api: PaletteApi): Action[] {
  return [
    newThread(api),
    { id: "cli", title: "Run a bb command", subtitle: "$", glyph: "cli", group: "Agent & CLI", keywords: ["bb", "cli", "shell", "run", "terminal", "command"], run: () => api.setQuery("$ ") },
    { id: "skills", title: "Skills", subtitle: "/", glyph: "skills", group: "Agent & CLI", keywords: ["skill", "slash", "slash command"], run: () => api.setQuery("/") },
    { id: "plugins", title: "Plugins", glyph: "plugins", group: "Agent & CLI", keywords: ["extensions", "reload", "enable", "disable", "logs"], run: () => api.push({ kind: "plugins" }), page: { kind: "plugins" } },
    { id: "shortcuts", title: "Keyboard shortcuts", subtitle: "?", glyph: "shortcuts", group: "Agent & CLI", keywords: ["keys", "hotkeys", "bindings", "help", "cheat sheet"], run: () => api.setQuery("?") },
  ];
}

function hostActions(api: PaletteApi): Action[] {
  const bindings = api.bootstrap?.keybindings ?? [];
  const onThread = api.bbContext.threadId !== null;
  return HOST_COMMANDS.filter((spec) => onThread || (spec.id !== "thread.rename" && spec.id !== "thread.archive")).map(
    (spec): Action => {
      const binding = findBinding(bindings, spec.id);
      return {
        id: `host:${spec.id}`,
        title: spec.title,
        subtitle: binding ? undefined : "No shortcut bound",
        glyph: spec.glyph,
        group: spec.group,
        keywords: spec.keywords ?? [],
        shortcut: binding?.shortcut ? formatShortcut(binding.shortcut, api.isMac) : undefined,
        disabled: binding === null,
        run: async () => {
          api.record(`host:${spec.id}`);
          const handled = await api.relay(spec.id);
          if (!handled) toast.error(`bb did not handle "${spec.title}" here.`);
        },
      };
    },
  );
}

function projectAction(api: PaletteApi, project: PaletteApi["threads"]["projects"][number]): Action {
  return {
    id: `project:${project.id}`,
    title: project.name,
    glyph: project.isPersonal ? "personal" : "folder",
    group: "Projects",
    keywords: ["project", project.name],
    run: () => {
      api.record("project:open");
      api.nav.toProject(project.id);
      api.close();
    },
    secondary: () => api.push({ kind: "project", projectId: project.id }),
    page: { kind: "project", projectId: project.id },
  };
}

function useRootActions(api: PaletteApi): { actions: Action[]; byId: Map<string, Action> } {
  const appearance = readAppearanceMode();
  return useMemo(() => {
    const list: Action[] = [
      ...appearanceActions(api, appearance),
      ...agentActions(api),
      ...hostActions(api),
      ...api.threads.threads.filter((thread) => !thread.isArchived).map((thread) => threadOpenAction(api, thread)),
      ...api.threads.projects.map((project) => projectAction(api, project)),
      ...(api.bootstrap?.theme.entries ?? []).map((entry) => themeAction(api, entry)),
    ];
    return { actions: list, byId: new Map(list.map((action) => [action.id, action])) };
  }, [api, appearance]);
}

function useRecentIds(): string[] {
  const map = useSyncExternalStore(recentsStore.subscribe, recentsStore.get, recentsStore.get);
  return useMemo(() => rank(map, Date.now(), 20), [map]);
}

/** Rows that draw something richer than a glyph in the leading slot. */
function leadingNode(api: PaletteApi, action: Action): ReactNode {
  if (action.id.startsWith("project:")) {
    return <ProjectIcon projectId={action.id.slice("project:".length)} isPersonal={action.glyph === "personal"} className="size-4" />;
  }
  if (action.id.startsWith("theme:") && action.id !== "theme:pick") {
    const themeId = action.id.slice("theme:".length);
    return <ThemeDot swatch={api.bootstrap?.theme.entries.find((entry) => entry.id === themeId)?.swatch} />;
  }
  if (action.id === "favicon:pick" && api.bootstrap) return <FaviconDot color={api.bootstrap.theme.faviconColor} />;
  return undefined;
}

function ActionRows({ actions, api, valuePrefix = "" }: { actions: readonly Action[]; api: PaletteApi; valuePrefix?: string }) {
  return (
    <>
      {actions.map((action) => (
        <PaletteRow
          key={action.id}
          value={`${valuePrefix}${action.id}`}
          data-action-id={`${valuePrefix}${action.id}`}
          keywords={action.searchText ?? [action.title, action.subtitle ?? "", ...(action.keywords ?? [])]}
          glyph={action.glyph ? GLYPHS[action.glyph] : undefined}
          iconNode={leadingNode(api, action)}
          title={action.title}
          meta={action.subtitle}
          shortcut={action.shortcut}
          disabled={action.disabled}
          active={action.active}
          hasPage={action.page !== undefined}
          onSelect={() => void action.run()}
        />
      ))}
    </>
  );
}

export function RootPage({ mode, text }: { mode: PrefixMode; text: string }) {
  const api = usePaletteApi();
  const { actions, byId } = useRootActions(api);
  useRegisterActions(actions);
  const recentIds = useRecentIds();

  const searching = text.trim() !== "";
  const virtual = mode === "threads";
  const showThreads = mode === "root" || virtual;
  const showProjects = mode === "root" || mode === "projects";
  const showCommands = mode === "root" || mode === "commands";
  const loadingThreads = api.threads.status === "loading";
  const loadingCommands = api.bootstrap === null;

  const projects = useMemo(() => new Map(api.threads.projects.map((project) => [project.id, project])), [api.threads.projects]);
  const projectName = useCallback((thread: PluginSidebarThread) => projects.get(thread.projectId)?.name, [projects]);
  const listed = useMemo(() => sortThreads(api.threads.threads.filter(isListedThread)), [api.threads.threads]);
  // Ranking a large list lags one keystroke behind typing rather than blocking it.
  const deferredText = useDeferredValue(text);
  const threads = useMemo(() => {
    if (virtual) return rankThreads(listed, deferredText, projectName);
    if (searching) return rankThreads(listed, deferredText, projectName).slice(0, SEARCH_THREAD_CAP);
    return listed.slice(0, ROOT_THREAD_CAP);
  }, [listed, virtual, searching, deferredText, projectName]);

  const recents =
    !searching && mode === "root"
      ? recentIds
          .map((id) => byId.get(id))
          .filter((action): action is Action => action !== undefined && !action.disabled)
          .slice(0, RECENT_CAP)
      : [];

  const commandGroups = COMMAND_GROUPS.map((group) => ({
    group,
    actions: actions.filter(
      (action) =>
        action.group === group &&
        (action.id === "theme:pick" || !action.id.startsWith("theme:")) &&
        !action.id.startsWith("thread:") &&
        // Unbound host commands only show while searching for them.
        (searching || !action.disabled),
    ),
  })).filter((entry) => entry.actions.length > 0);

  return (
    <>
      {recents.length > 0 ? (
        <CommandGroup heading="Recent">
          <ActionRows api={api} actions={recents} valuePrefix="recent:" />
        </CommandGroup>
      ) : null}
      {showThreads && loadingThreads ? <LoadingRows count={5} /> : null}
      {virtual && !loadingThreads ? (
        <VirtualThreadList threads={threads} projects={projects} byId={byId} query={deferredText} />
      ) : showThreads && threads.length > 0 ? (
        <CommandGroup heading="Threads">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              project={projects.get(thread.projectId)}
              actionId={`thread:${thread.id}:open`}
              onSelect={() => void byId.get(`thread:${thread.id}:open`)?.run()}
            />
          ))}
        </CommandGroup>
      ) : null}
      {showProjects && api.threads.projects.length > 0 ? (
        <CommandGroup heading="Projects">
          <ActionRows api={api} actions={actions.filter((action) => action.group === "Projects")} />
        </CommandGroup>
      ) : null}
      {showCommands && loadingCommands && !loadingThreads ? <LoadingRows count={3} /> : null}
      {showCommands
        ? commandGroups.map((entry) => (
            <CommandGroup key={entry.group} heading={entry.group}>
              <ActionRows api={api} actions={entry.actions} />
            </CommandGroup>
          ))
        : null}
      {showCommands && searching ? (
        <CommandGroup heading="Themes">
          <ActionRows api={api} actions={actions.filter((action) => action.id.startsWith("theme:") && action.id !== "theme:pick")} />
        </CommandGroup>
      ) : null}
    </>
  );
}
