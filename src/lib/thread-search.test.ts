import { describe, expect, it } from "vitest";
import { rankThreads, threadSearchText, type ThreadSearchFields } from "@/lib/thread-search";

type Thread = ThreadSearchFields & { id: string; projectId: string };

const threads: Thread[] = [
  { id: "a", projectId: "p1", title: "Fix login redirect", titleFallback: null, environment: { branchName: "feat/auth" } },
  { id: "b", projectId: "p2", title: null, titleFallback: "why cant i change theme?", environment: null },
  { id: "c", projectId: "p1", title: "Theme preview polish", titleFallback: null, environment: { branchName: "theme-dots" } },
  { id: "d", projectId: "p3", title: "Refactor palette store", titleFallback: null, host: { name: "studio" } },
];
const projectName = (thread: Thread) => ({ p1: "Personal", p2: "Website", p3: "bb-plugins" })[thread.projectId];

describe("rankThreads", () => {
  it("keeps the incoming order for an empty query", () => {
    expect(rankThreads(threads, "   ", projectName).map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops non-matches and puts the strongest match first", () => {
    const ids = rankThreads(threads, "theme", projectName).map((t) => t.id);
    expect(ids[0]).toBe("c"); // title starts with the query
    expect(ids).toContain("b"); // fallback title contains it
    expect(ids).not.toContain("a");
    expect(ids).not.toContain("d");
  });

  it("matches project, branch and host names, not just titles", () => {
    expect(rankThreads(threads, "website", projectName).map((t) => t.id)).toEqual(["b"]);
    expect(rankThreads(threads, "feat/auth", projectName).map((t) => t.id)).toEqual(["a"]);
    expect(rankThreads(threads, "studio", projectName).map((t) => t.id)).toEqual(["d"]);
  });

  it("breaks ties by incoming order", () => {
    const ids = rankThreads(threads, "personal", projectName).map((t) => t.id);
    expect(ids).toEqual(["a", "c"]);
  });
});

describe("threadSearchText", () => {
  it("falls back to the placeholder title and skips missing fields", () => {
    expect(threadSearchText({ title: null, titleFallback: null })).toBe("Untitled thread");
    expect(threadSearchText(threads[0]!, "Personal")).toBe("Fix login redirect Personal feat/auth");
  });
});
