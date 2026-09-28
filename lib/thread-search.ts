// Thread search. `@` mode windows an unbounded list, so matching cannot be
// left to cmdk (it only sees mounted rows): rank here, then window the result.
// The root list reuses the same ranking to cap its "Threads" group while a
// search is typed. Pure and SDK-free so it unit-tests in isolation.
import { scoreMatch } from "./fuzzy";

/** The thread fields a row is searched by. Structurally satisfied by the sidebar's thread type. */
export type ThreadSearchFields = {
  title: string | null;
  titleFallback: string | null;
  environment?: { branchName: string | null } | null;
  host?: { name: string } | null;
};

export function threadTitle(thread: Pick<ThreadSearchFields, "title" | "titleFallback">): string {
  return thread.title ?? thread.titleFallback ?? "Untitled thread";
}

/** Title, project, branch, host: everything a row shows is something you can type. */
export function threadSearchText(thread: ThreadSearchFields, projectName?: string): string {
  return [threadTitle(thread), projectName ?? "", thread.environment?.branchName ?? "", thread.host?.name ?? ""]
    .filter(Boolean)
    .join(" ");
}

/**
 * Threads matching `query`, best match first; ties keep the incoming order,
 * which is the sidebar's (pinned, unread, recent). An empty query returns
 * every thread in that order.
 */
export function rankThreads<T extends ThreadSearchFields>(
  threads: readonly T[],
  query: string,
  projectName: (thread: T) => string | undefined,
): T[] {
  const needle = query.trim();
  if (needle === "") return [...threads];
  const scored: Array<{ thread: T; score: number; index: number }> = [];
  threads.forEach((thread, index) => {
    const score = scoreMatch(threadSearchText(thread, projectName(thread)), needle);
    if (score > 0) scored.push({ thread, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.thread);
}
