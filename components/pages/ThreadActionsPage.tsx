// Actions for one thread. Reused by the "Current thread" group on the root
// page (same builder) and by → / Tab on any thread row.
import { useMemo } from "react";
import { toast } from "sonner";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi, useRegisterActions, type PaletteApi } from "@/components/PaletteContext";
import { threadTitle } from "@/components/ThreadRow";
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
  const title = threadTitle(thread);
  const busy = thread.indicator === "runtime" || thread.activity.backgroundAgents + thread.activity.workflows > 0;
  const prefix = `thread:${id}:`;
  const actions: Action[] = [
    {
      id: `${prefix}open`,
      title: "Open",
      subtitle: title,
      icon: "ArrowUpRight",
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
      icon: "Columns2",
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
      title: "Send a message…",
      icon: "Sent",
      group,
      keywords: ["prompt", "steer", "queue"],
      run: () => api.push({ kind: "send", threadId: id }),
      page: { kind: "send", threadId: id },
    },
    ...(busy
      ? [
          {
            id: `${prefix}stop`,
            title: "Stop",
            icon: "Square",
            group,
            keywords: ["cancel", "abort", "interrupt"],
            run: serverAction(api, id, "stop", "Stopped"),
          } satisfies Action,
        ]
      : []),
    {
      id: `${prefix}pin`,
      title: thread.isPinned ? "Unpin" : "Pin",
      icon: thread.isPinned ? "PinOff" : "Pin",
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
      icon: thread.isUnread ? "MailOpen" : "Mail",
      group,
      run: async () => {
        await api.threadActions.setRead(id, thread.isUnread);
        api.record("thread:read");
        api.close();
      },
    },
    {
      id: `${prefix}rename`,
      title: "Rename…",
      icon: "Edit",
      group,
      keywords: ["title"],
      subtitle: api.bbContext.threadId === id ? undefined : "Opens the thread first",
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
      subtitle: "New thread continuing from here",
      icon: "Fork",
      group,
      run: serverAction(api, id, "fork", "Forked"),
    },
    {
      id: `${prefix}compact`,
      title: "Compact context",
      icon: "CircleArrowShrink",
      group,
      keywords: ["summarize", "context window"],
      run: serverAction(api, id, "compact", "Compacting…"),
    },
    {
      id: `${prefix}archive`,
      title: thread.isArchived ? "Unarchive" : "Archive",
      icon: thread.isArchived ? "ArchiveRestore" : "Archive",
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
      icon: "Copy",
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
      title: "Delete…",
      subtitle: "Asks for confirmation",
      icon: "Trash2",
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
    <CommandGroup heading={threadTitle(thread)}>
      {actions.map((action) => (
        <PaletteRow
          key={action.id}
          value={action.id}
          data-action-id={action.id}
          keywords={[action.title, ...(action.keywords ?? [])]}
          icon={action.icon}
          title={action.title}
          subtitle={action.subtitle}
          hasPage={action.page !== undefined}
          onSelect={() => void action.run()}
        />
      ))}
    </CommandGroup>
  );
}
