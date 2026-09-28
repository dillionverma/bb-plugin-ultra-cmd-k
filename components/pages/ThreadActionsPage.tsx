// Actions for one thread. Reused by the "This thread" group on the root
// page (same builder) and by → / Tab on any thread row.
import { useMemo } from "react";
import { toast } from "sonner";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi, useRegisterActions, type PaletteApi } from "@/components/PaletteContext";
import { ThreadGlyph, threadTitle } from "@/components/ThreadRow";
import { GLYPHS } from "@/lib/glyphs";
import type { Action } from "@/lib/palette-types";
import type { ThreadAction } from "@/lib/contract";

function serverAction(api: PaletteApi, threadId: string, action: ThreadAction, done: string) {
  return async () => {
    try {
      const result = await api.rpc.call("thread_action", { threadId, action });
      api.record(`thread-action:${action}`);
      toast.success(done);
      if (action === "fork" && result.threadId) api.nav.toThread(result.threadId);
      api.close();
    } catch (error) {
      api.reportError(error);
    }
  };
}

/** Rows for a thread; `group` names the cmdk group they render under. */
export function buildThreadActions(api: PaletteApi, thread: PluginSidebarThread, group: string): Action[] {
  const id = thread.id;
  const busy = thread.indicator === "runtime" || thread.activity.backgroundAgents + thread.activity.workflows > 0;
  const prefix = `thread:${id}:`;
  const actions: Action[] = [
    {
      id: `${prefix}open`,
      title: "Open",
      glyph: "open",
      group,
      keywords: ["go to", "jump"],
      run: () => {
        api.threadActions.open(id);
        api.record("thread:open");
        api.close();
      },
      secondary: () => {
        api.threadActions.open(id, { split: true });
        api.record("thread:open-split");
        api.close();
      },
      secondaryHint: "Open in split",
    },
    {
      id: `${prefix}split`,
      title: "Open in split",
      glyph: "split",
      group,
      keywords: ["side by side", "pane"],
      run: () => {
        api.threadActions.open(id, { split: true });
        api.record("thread:open-split");
        api.close();
      },
    },
    {
      id: `${prefix}send`,
      title: "Send a message",
      glyph: "send",
      group,
      keywords: ["prompt", "steer", "queue", "tell"],
      run: () => api.push({ kind: "send", threadId: id }),
      page: { kind: "send", threadId: id },
    },
    ...(busy
      ? [
          {
            id: `${prefix}stop`,
            title: "Stop",
            glyph: "stop",
            group,
            keywords: ["cancel", "abort", "interrupt"],
            run: serverAction(api, id, "stop", "Stopped"),
          } satisfies Action,
        ]
      : []),
    {
      id: `${prefix}pin`,
      title: thread.isPinned ? "Unpin" : "Pin",
      glyph: thread.isPinned ? "unpin" : "pin",
      group,
      run: async () => {
        await api.threadActions.setPinned(id, !thread.isPinned);
        api.record("thread:pin");
        toast.success(thread.isPinned ? "Unpinned" : "Pinned");
        api.close();
      },
    },
    {
      id: `${prefix}read`,
      title: thread.isUnread ? "Mark as read" : "Mark as unread",
      glyph: thread.isUnread ? "markRead" : "markUnread",
      group,
      run: async () => {
        await api.threadActions.setRead(id, thread.isUnread);
        api.record("thread:read");
        api.close();
      },
    },
    {
      id: `${prefix}rename`,
      title: "Rename",
      glyph: "rename",
      group,
      keywords: ["title"],
      subtitle: api.bbContext.threadId === id ? undefined : "opens the thread first",
      run: async () => {
        if (api.bbContext.threadId !== id) api.threadActions.open(id);
        const handled = await api.relay("thread.rename");
        if (!handled) toast.error("Rename is not bound to a shortcut; rename from the thread header.");
        api.record("thread:rename");
      },
    },
    {
      id: `${prefix}fork`,
      title: "Fork",
      subtitle: "new thread from here",
      glyph: "fork",
      group,
      run: serverAction(api, id, "fork", "Forked"),
    },
    {
      id: `${prefix}compact`,
      title: "Compact context",
      glyph: "compact",
      group,
      keywords: ["summarize", "context window"],
      run: serverAction(api, id, "compact", "Compacting…"),
    },
    {
      id: `${prefix}archive`,
      title: thread.isArchived ? "Unarchive" : "Archive",
      glyph: thread.isArchived ? "unarchive" : "archive",
      group,
      run: thread.isArchived
        ? serverAction(api, id, "unarchive", "Unarchived")
        : () => {
            api.threadActions.archive(id);
            api.record("thread:archive");
            toast.success("Archived");
            api.close();
          },
    },
    {
      id: `${prefix}copy-id`,
      title: "Copy thread id",
      subtitle: id,
      glyph: "copy",
      group,
      run: async () => {
        await navigator.clipboard.writeText(id);
        api.record("thread:copy-id");
        toast.success("Copied thread id");
        api.close();
      },
    },
    {
      id: `${prefix}delete`,
      title: "Delete",
      subtitle: "asks first",
      glyph: "trash",
      group,
      run: () => {
        api.threadActions.requestDelete(id);
        api.close();
      },
    },
  ];
  return actions;
}

export function ThreadActionsPage({ threadId }: { threadId: string }) {
  const api = usePaletteApi();
  const thread = api.threads.threads.find((entry) => entry.id === threadId);
  const actions = useMemo(
    () => (thread ? buildThreadActions(api, thread, threadTitle(thread)) : []),
    [api, thread],
  );
  useRegisterActions(actions);
  if (!thread) {
    return (
      <CommandGroup heading="Thread">
        <PaletteRow value="missing" keywords={[]} icon="AlertCircle" title="This thread is no longer listed" disabled onSelect={() => {}} />
      </CommandGroup>
    );
  }
  return (
    <CommandGroup
      heading={
        <span className="inline-flex items-center gap-1.5">
          <ThreadGlyph thread={thread} />
          <span className="truncate">{threadTitle(thread)}</span>
        </span>
      }
    >
      {actions.map((action) => (
        <PaletteRow
          key={action.id}
          value={action.id}
          data-action-id={action.id}
          keywords={[action.title, ...(action.keywords ?? [])]}
          glyph={action.glyph ? GLYPHS[action.glyph] : undefined}
          title={action.title}
          meta={action.subtitle}
          hasPage={action.page !== undefined}
          onSelect={() => void action.run()}
        />
      ))}
    </CommandGroup>
  );
}
