// Action builders shared by more than one page, so a thread row means the
// same thing in the root list, a project page, and the Recent group.
import { toast } from "sonner";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import type { PaletteApi } from "@/components/PaletteContext";
import { commitTheme } from "@/components/ThemePreview";
import { ULTRA_LAUNCHER, type ThemeEntry } from "@/lib/contract";
import type { Action } from "@/lib/palette-types";
import { threadTitle } from "@/lib/thread-search";

export function startNewThread(api: PaletteApi, projectId: string | undefined): void {
  api.close();
  if (api.bootstrap?.launcherRunning) window.dispatchEvent(new Event(ULTRA_LAUNCHER.openEvent));
  else api.nav.toCompose({ projectId, focusPrompt: true });
}

export function threadOpenAction(api: PaletteApi, thread: PluginSidebarThread): Action {
  return {
    id: `thread:${thread.id}:open`,
    title: threadTitle(thread),
    glyph: "thread",
    group: "Threads",
    run: () => {
      api.record("thread:open");
      api.nav.toThread(thread.id);
      api.close();
    },
    secondary: () => {
      api.record("thread:open-split");
      api.nav.toThread(thread.id, { split: true });
      api.close();
    },
    page: { kind: "thread", threadId: thread.id },
  };
}

export function themeAction(api: PaletteApi, entry: ThemeEntry, group = "Appearance"): Action {
  return {
    id: `theme:${entry.id}`,
    title: entry.name,
    subtitle: "Theme",
    glyph: "theme",
    group,
    // Found by the theme's own name or the word "theme"; the picker row
    // matches "theme" too and sits above this group.
    searchText: [entry.name, entry.id, "theme"],
    active: entry.id === api.bootstrap?.theme.activeId,
    run: async () => {
      try {
        commitTheme(entry.id);
        await api.rpc.call("set_theme", { themeId: entry.id });
        api.record(`theme:${entry.id}`);
        await api.refreshBootstrap();
        toast.success(`Theme: ${entry.name}`);
        api.close();
      } catch (error) {
        api.reportError(error);
      }
    },
  };
}

/** Sidebar order: pinned, then unread, then most recent. */
export function sortThreads(threads: readonly PluginSidebarThread[]): PluginSidebarThread[] {
  return [...threads].sort(
    (a, b) =>
      Number(b.isPinned) - Number(a.isPinned) ||
      Number(b.isUnread) - Number(a.isUnread) ||
      b.updatedAt - a.updatedAt,
  );
}

export function isListedThread(thread: PluginSidebarThread): boolean {
  return !thread.isArchived && thread.parentThreadId === null;
}
