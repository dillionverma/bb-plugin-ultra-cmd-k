// A thread in the palette, composed like an Ultra Sidebar row: the agent's
// orb while it is in motion or waiting on you, else Linear's status ring;
// the title; then muted meta — provider logo, project, branch, age.
import { memo } from "react";
import { experimental_ProviderIcon as ProviderIcon } from "@get-bb/plugin-sdk/app";
import type { PluginSidebarProject, PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { HugeiconsIcon } from "@hugeicons/react";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import { ProjectIcon } from "@/components/ProjectIcon";
import { StatusIcon, type StatusTone } from "@/components/StatusIcon";
import { ThreadOrb, agentOrb } from "@/components/ThreadOrb";
import { GLYPHS } from "@/lib/glyphs";
import { threadSearchText, threadTitle } from "@/lib/thread-search";

function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}

function threadTone(thread: PluginSidebarThread): StatusTone {
  if (thread.hasPendingInteraction || thread.indicator === "waiting-for-input") return "needs-you";
  if (thread.indicator === "unread-error") return "problem";
  if (thread.indicator === "runtime" || thread.indicator === "working-draft") return "working";
  if (thread.indicator === "unread-success") return "done";
  if (thread.isUnread) return "unread";
  return "idle";
}

/** Orb while the agent moves, ring otherwise — never both. */
export function ThreadGlyph({ thread }: { thread: PluginSidebarThread }) {
  const orb = agentOrb(thread);
  if (orb) return <ThreadOrb orb={orb} />;
  return <StatusIcon tone={threadTone(thread)} />;
}

export const ThreadRow = memo(function ThreadRow({
  thread,
  project,
  actionId,
  onSelect,
  showProject = true,
}: {
  thread: PluginSidebarThread;
  project: PluginSidebarProject | undefined;
  actionId: string;
  onSelect: () => void;
  showProject?: boolean;
}) {
  const api = usePaletteApi();
  const provider = api.providers.get(thread.providerId) ?? { id: thread.providerId };
  const title = threadTitle(thread);
  const branch = thread.environment?.branchName ?? null;
  return (
    <PaletteRow
      value={actionId}
      data-action-id={actionId}
      keywords={[threadSearchText(thread, project?.name)]}
      iconNode={<ThreadGlyph thread={thread} />}
      title={title}
      hasPage
      onSelect={onSelect}
      trailing={
        <span className="flex min-w-0 shrink items-center gap-2 text-[11px] leading-4 text-muted-foreground">
          {thread.isPinned ? <HugeiconsIcon icon={GLYPHS.pin} className="size-3 shrink-0" aria-label="Pinned" /> : null}
          <ProviderIcon providerKind="agent" provider={provider} className="size-3 shrink-0 opacity-80" />
          {showProject && project ? (
            <span className="inline-flex min-w-0 max-w-32 items-center gap-1">
              <ProjectIcon projectId={project.id} isPersonal={project.isPersonal} className="size-3" />
              <span className="truncate">{project.name}</span>
            </span>
          ) : null}
          {branch ? (
            <span className="hidden min-w-0 max-w-36 items-center gap-1 sm:inline-flex">
              <HugeiconsIcon icon={GLYPHS.branch} className="size-3 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{branch}</span>
            </span>
          ) : null}
          <span className="w-7 shrink-0 text-right tabular-nums">{relativeTime(thread.updatedAt)}</span>
        </span>
      }
    />
  );
});
