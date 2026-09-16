// The root list: recents, current-thread actions, threads, projects,
// appearance, agent/CLI entry points, and every host command with a binding.
import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { ThreadRow, threadTitle } from "@/components/ThreadRow";
import { usePaletteApi, useRegisterActions, type PaletteApi } from "@/components/PaletteContext";
import { buildThreadActions } from "@/components/pages/ThreadActionsPage";
import { APPEARANCE_MODES, readAppearanceMode, writeAppearanceMode, type AppearanceMode } from "@/lib/appearance";
import { findBinding, formatShortcut, HOST_COMMANDS } from "@/lib/host-commands";
import { OPEN_LAUNCHER_EVENT } from "@/lib/launcher";
import { GROUP_ORDER, type Action, type PrefixMode } from "@/lib/palette-types";
import { rank, recentsStore } from "@/lib/recents";

const ROOT_THREAD_CAP = 8;
const SEARCH_THREAD_CAP = 300;
const RECENT_CAP = 5;

const MODE_LABEL: Record<AppearanceMode, string> = { light: "Light", dark: "Dark", system: "System" };
const MODE_ICON: Record<AppearanceMode, string> = { light: "Eye", dark: "EyeOff", system: "Laptop" };

function newThread(api: PaletteApi): Action {
  const launcher = api.bootstrap?.launcherInstalled === true;
  return {
    id: "new-thread",
    title: "New thread",
    subtitle: launcher ? "Ultra Launcher" : undefined,
    icon: "MessageSquarePlus",
    group: "Agent & CLI",
    keywords: ["create", "start", "compose", "cmd+n"],
    run: () => {
      api.record("new-thread");
      api.close();
      if (launcher) window.dispatchEvent(new Event(OPEN_LAUNCHER_EVENT));
      else api.threadActions.openNewThread({ projectId: api.bbContext.projectId ?? undefined, focusPrompt: true });
    },
  };
}

function appearanceActions(api: PaletteApi, current: AppearanceMode): Action[] {
  const theme = api.bootstrap?.theme;
  const activeTheme = theme?.entries.find((entry) => entry.id === theme.activeId);
  return [
    {
      id: "theme:pick",
      title: `Theme: ${activeTheme?.name ?? theme?.activeId ?? "…"}`,
      icon: "Palette",
      group: "Appearance",
      keywords: ["theme", "palette", "colors", "dracula", "nord", "catppuccin"],
      run: () => api.push({ kind: "themes" }),
      page: { kind: "themes" },
    },
    ...APPEARANCE_MODES.map(
      (mode): Action => ({
        id: `appearance:${mode}`,
        title: `${MODE_LABEL[mode]} appearance`,
        subtitle: mode === current ? "Active" : undefined,
        icon: MODE_ICON[mode],
        group: "Appearance",
        keywords: ["light", "dark", "mode", "system", "appearance", mode],
        run: () => {
          writeAppearanceMode(mode);
          api.record(`appearance:${mode}`);
          toast.success(`${MODE_LABEL[mode]} appearance`);
          api.close();
        },
      }),
    ),
    {
      id: "favicon:pick",
      title: `Favicon color: ${theme?.faviconColor ?? "…"}`,
      icon: "Circle",
      group: "Appearance",
      keywords: ["favicon", "tab icon", "color"],
      run: () => api.push({ kind: "favicon" }),
      page: { kind: "favicon" },
    },
  ];
}

function agentActions(api: PaletteApi): Action[] {
  return [
    newThread(api),
    {
      id: "cli",
      title: "Run a bb command…",
      subtitle: "$",
      icon: "Terminal",
      group: "Agent & CLI",
      keywords: ["bb", "cli", "shell", "run"],
      run: () => api.setQuery("$ "),
    },
    {
      id: "skills",
      title: "Skills…",
      subtitle: "/",
      icon: "Zap",
      group: "Agent & CLI",
      keywords: ["skill", "slash", "command"],
      run: () => api.setQuery("/"),
    },
    {
      id: "plugins",
      title: "Plugins…",
      icon: "Puzzle",
      group: "Agent & CLI",
      keywords: ["extensions", "reload", "enable", "disable"],
      run: () => api.push({ kind: "plugins" }),
      page: { kind: "plugins" },
    },
    {
      id: "shortcuts",
      title: "Keyboard shortcuts…",
      subtitle: "?",
      icon: "CircleQuestion",
      group: "Agent & CLI",
      keywords: ["keys", "hotkeys", "bindings", "help"],
      run: () => api.setQuery("?"),
    },
  ];
}

function hostActions(api: PaletteApi): Action[] {
  const bindings = api.bootstrap?.keybindings ?? [];
  const onThread = api.bbContext.threadId !== null;
  return HOST_COMMANDS.filter((spec) => onThread || !spec.id.startsWith("thread.rename") && !spec.id.startsWith("thread.archive"))
    .map((spec): Action => {
      const binding = findBinding(bindings, spec.id);
      return {
        id: `host:${spec.id}`,
        title: spec.title,
        subtitle: binding ? spec.description : "No shortcut bound",
        icon: spec.icon,
        group: spec.group,
        keywords: [spec.description, ...(spec.keywords ?? [])],
        shortcut: binding?.shortcut ? formatShortcut(binding.shortcut, api.isMac) : undefined,
        disabled: binding === null,
        run: async () => {
          api.record(`host:${spec.id}`);
          const handled = await api.relay(spec.id);
          if (!handled) toast.error(`bb did not handle "${spec.title}" here.`);
        },
      };
    });
}

export function useRootActions(api: PaletteApi): { actions: Action[]; byId: Map<string, Action> } {
  const appearance = readAppearanceMode();
  const currentThread = api.bbContext.threadId
    ? api.threads.threads.find((thread) => thread.id === api.bbContext.threadId)
    : undefined;
  return useMemo(() => {
    const list: Action[] = [
      ...(currentThread
        ? buildThreadActions(api, currentThread, "Current thread").filter((action) => !action.id.endsWith(":open"))
        : []),
      ...appearanceActions(api, appearance),
      ...agentActions(api),
      ...hostActions(api),
    ];
    for (const thread of api.threads.threads) {
      if (thread.isArchived) continue;
      list.push({
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
        secondaryHint: "Open in split",
        page: { kind: "thread", threadId: thread.id },
      });
    }
    for (const project of api.threads.projects) {
      list.push({
        id: `project:${project.id}`,
        title: project.name,
        icon: project.isPersonal ? "UserRound" : "Folder",
        group: "Projects",
        keywords: ["project", project.name],
        run: () => {
          api.record("project:open");
          api.nav.toProject(project.id);
          api.close();
        },
        secondary: () => api.push({ kind: "project", projectId: project.id }),
        page: { kind: "project", projectId: project.id },
      });
    }
    for (const entry of api.bootstrap?.theme.entries ?? []) {
      list.push({
        id: `theme:${entry.id}`,
        title: `Theme: ${entry.name}`,
        icon: "Palette",
        group: "Appearance",
        // Found by the theme's own name, never by the word "theme" — that
        // belongs to the picker row so a generic query lands there.
        searchText: [entry.name, entry.id],
        run: async () => {
          try {
            await api.rpc.call("set_theme", { themeId: entry.id });
            api.record(`theme:${entry.id}`);
            await api.refreshBootstrap();
            toast.success(`Theme: ${entry.name}`);
            api.close();
          } catch (error) {
            api.reportError(error);
          }
        },
      });
    }
    return { actions: list, byId: new Map(list.map((action) => [action.id, action])) };
    // bootstrap/threads/context are the inputs that change what rows exist.
  }, [api, appearance, currentThread]);
}

function useRecentIds(): string[] {
  const map = useSyncExternalStore(recentsStore.subscribe, recentsStore.get, recentsStore.get);
  return useMemo(() => rank(map, Date.now(), 20), [map]);
}

function ActionRows({ actions }: { actions: readonly Action[] }) {
  return (
    <>
      {actions.map((action) => (
        <PaletteRow
          key={action.id}
          value={action.id}
          data-action-id={action.id}
          keywords={action.searchText ?? [action.title, action.subtitle ?? "", ...(action.keywords ?? [])]}
          icon={action.icon}
          title={action.title}
          subtitle={action.subtitle}
          shortcut={action.shortcut}
          disabled={action.disabled}
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
  const showThreads = mode === "root" || mode === "threads";
  const showProjects = mode === "root" || mode === "projects";
  const showCommands = mode === "root" || mode === "commands";

  const projects = new Map(api.threads.projects.map((project) => [project.id, project]));
  const threads = api.threads.threads
    .filter((thread) => !thread.isArchived && thread.parentThreadId === null)
    .sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        Number(b.isUnread) - Number(a.isUnread) ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, mode === "threads" || searching ? SEARCH_THREAD_CAP : ROOT_THREAD_CAP);

  const recents = !searching && mode === "root"
    ? recentIds
        .map((id) => byId.get(id))
        .filter((action): action is Action => action !== undefined && !action.disabled)
        .slice(0, RECENT_CAP)
    : [];

  const commandGroups = GROUP_ORDER.filter((group) => !["Recent", "Threads", "Projects"].includes(group)).map(
    (group) => ({
      group,
      actions: actions.filter(
        (action) =>
          action.group === group &&
          (action.id === "theme:pick" || !action.id.startsWith("theme:")) &&
          !action.id.startsWith("thread:"),
      ),
    }),
  );

  return (
    <>
      {recents.length > 0 ? (
        <CommandGroup heading="Recent">
          <ActionRows actions={recents.map((action) => ({ ...action, id: `recent:${action.id}` }))} />
        </CommandGroup>
      ) : null}
      {showThreads && threads.length > 0 ? (
        <CommandGroup heading="Threads">
          {threads.map((thread) => {
            const action = byId.get(`thread:${thread.id}:open`);
            return (
              <ThreadRow
                key={thread.id}
                thread={thread}
                project={projects.get(thread.projectId)}
                actionId={`thread:${thread.id}:open`}
                onSelect={() => void action?.run()}
              />
            );
          })}
        </CommandGroup>
      ) : null}
      {showProjects && api.threads.projects.length > 0 ? (
        <CommandGroup heading="Projects">
          <ActionRows actions={actions.filter((action) => action.group === "Projects")} />
        </CommandGroup>
      ) : null}
      {showCommands
        ? commandGroups
            .filter((entry) => entry.actions.length > 0)
            .map((entry) => (
              <CommandGroup key={entry.group} heading={entry.group}>
                <ActionRows actions={entry.actions} />
              </CommandGroup>
            ))
        : null}
      {/* Theme rows exist only so "dracula" finds a theme while searching. */}
      {showCommands && searching ? (
        <CommandGroup heading="Themes">
          <ActionRows actions={actions.filter((action) => action.id.startsWith("theme:") && action.id !== "theme:pick")} />
        </CommandGroup>
      ) : null}
    </>
  );
}
