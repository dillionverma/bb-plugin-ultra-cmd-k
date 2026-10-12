import { useMemo } from "react";
import { toast } from "sonner";
import {
  experimental_copyToClipboard,
  experimental_useThreadActions,
  useSdk,
  type PluginBrowserBbSdk,
  type PluginSidebarThread,
  type PluginThreadActionEntry,
  type PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi, useRegisterActions, type PaletteApi } from "@/components/PaletteContext";
import { ThreadGlyph } from "@/components/ThreadRow";
import { GLYPHS } from "@/lib/glyphs";
import type { Action } from "@/lib/palette-types";
import type { ThreadAction } from "@/lib/contract";
import { threadTitle } from "@/lib/thread-search";

/** bb's own archive and delete flows: child-thread confirmation, pane cleanup, Undo. */
const ARCHIVE = "bb--core/archive";
const DELETE = "bb--core/delete";
const LIFECYCLE = { keys: [ARCHIVE, DELETE] };

function actionTarget(thread: PluginSidebarThread): PluginThreadActionTarget {
  const environment = thread.environment;
  return { ...thread, environment: environment?.id ? { id: environment.id, path: environment.path } : null };
}

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

function buildThreadActions(
  api: PaletteApi,
  sdk: PluginBrowserBbSdk,
  thread: PluginSidebarThread,
  lifecycle: readonly PluginThreadActionEntry[],
): Action[] {
  const id = thread.id;
  const group = threadTitle(thread);
  const archive = lifecycle.find((entry) => entry.key === ARCHIVE)?.action;
  const remove = lifecycle.find((entry) => entry.key === DELETE)?.action;
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
        api.nav.toThread(id);
        api.record("thread:open");
        api.close();
      },
      secondary: () => {
        api.nav.toThread(id, { split: true });
        api.record("thread:open-split");
        api.close();
      },
    },
    {
      id: `${prefix}split`,
      title: "Open in split",
      glyph: "split",
      group,
      keywords: ["side by side", "pane"],
      run: () => {
        api.nav.toThread(id, { split: true });
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
        try {
          await (thread.isPinned ? sdk.threads.unpin({ threadId: id }) : sdk.threads.pin({ threadId: id }));
          api.record("thread:pin");
          toast.success(thread.isPinned ? "Unpinned" : "Pinned");
          api.close();
        } catch (error) {
          api.reportError(error);
        }
      },
    },
    {
      id: `${prefix}read`,
      title: thread.isUnread ? "Mark as read" : "Mark as unread",
      glyph: thread.isUnread ? "markRead" : "markUnread",
      group,
      run: async () => {
        try {
          await (thread.isUnread ? sdk.threads.markRead({ threadId: id }) : sdk.threads.markUnread({ threadId: id }));
          api.record("thread:read");
          api.close();
        } catch (error) {
          api.reportError(error);
        }
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
        if (api.bbContext.threadId !== id) api.nav.toThread(id);
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
    ...(thread.isArchived
      ? [
          {
            id: `${prefix}archive`,
            title: "Unarchive",
            glyph: "unarchive",
            group,
            run: serverAction(api, id, "unarchive", "Unarchived"),
          } satisfies Action,
        ]
      : []),
    ...(archive && !thread.isArchived
      ? [
          {
            id: `${prefix}archive`,
            title: "Archive",
            glyph: "archive",
            group,
            run: () => {
              void archive.run();
              api.record("thread:archive");
              api.close();
            },
          } satisfies Action,
        ]
      : []),
    {
      id: `${prefix}copy-id`,
      title: "Copy thread id",
      subtitle: id,
      glyph: "copy",
      group,
      run: async () => {
        if (!(await experimental_copyToClipboard({ text: id }))) {
          toast.error("Could not copy the thread id");
          return;
        }
        api.record("thread:copy-id");
        toast.success("Copied thread id");
        api.close();
      },
    },
    ...(remove
      ? [
          {
            id: `${prefix}delete`,
            title: "Delete",
            subtitle: "asks first",
            glyph: "trash",
            group,
            run: () => {
              void remove.run();
              api.close();
            },
          } satisfies Action,
        ]
      : []),
  ];
  return actions;
}

export function ThreadActionsPage({ threadId }: { threadId: string }) {
  const api = usePaletteApi();
  const thread = api.threads.threads.find((entry) => entry.id === threadId);
  if (!thread) {
    return (
      <CommandGroup heading="Thread">
        <PaletteRow value="missing" keywords={[]} icon="AlertCircle" title="This thread is no longer listed" disabled onSelect={() => {}} />
      </CommandGroup>
    );
  }
  return <ThreadActions thread={thread} />;
}

function ThreadActions({ thread }: { thread: PluginSidebarThread }) {
  const api = usePaletteApi();
  const sdk = useSdk();
  const target = useMemo(() => actionTarget(thread), [thread]);
  const lifecycle = experimental_useThreadActions(target, LIFECYCLE);
  const actions = useMemo(() => buildThreadActions(api, sdk, thread, lifecycle), [api, sdk, thread, lifecycle]);
  useRegisterActions(actions);
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
