import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginThreadActionEntry,
  PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { Bootstrap } from "@/lib/contract";
import { paletteStore } from "@/lib/palette-store";

const project: PluginSidebarProject = {
  id: "pr_1",
  name: "Website",
  isPersonal: false,
  href: "/projects/pr_1",
  settingsHref: "/projects/pr_1/settings",
};

const thread: PluginSidebarThread = {
  id: "th_1",
  projectId: "pr_1",
  title: "Fix login redirect",
  titleFallback: null,
  displayTitle: "Fix login redirect",
  parentThreadId: null,
  lifecycleOwnerThreadId: null,
  sourceThreadId: null,
  sectionId: null,
  originKind: null,
  originPluginId: null,
  providerId: "codex",
  status: "idle",
  runtimeStatus: "idle",
  queuedWork: "none",
  hasPendingInteraction: false,
  activity: { workflows: 0, backgroundAgents: 0, backgroundCommands: 0, planMode: 0, goals: 0 },
  indicator: "none",
  indicatorLabel: null,
  isUnread: true,
  isPinned: false,
  pinnedAt: null,
  pinSortKey: null,
  isArchived: false,
  archivedAt: null,
  href: "/projects/pr_1/threads/th_1",
  isHidden: false,
  environment: null,
  host: null,
  createdAt: 1,
  updatedAt: 2,
  lastReadAt: null,
  latestAttentionAt: 2,
};

const bootstrap: Bootstrap = {
  hotkey: { state: "free", reason: "claimed", description: "" },
  keybindings: [],
  theme: { activeId: "default", faviconColor: "default", entries: [] },
  launcherInstalled: false,
  plugins: [],
  hosts: [],
  primaryHostId: null,
};

function coreAction(key: string, run: () => Promise<void>): PluginThreadActionEntry {
  return { key, pluginId: "bb--core", group: "lifecycle", action: { label: key, icon: "Zap", run } };
}

beforeAll(() => {
  // jsdom lacks these: cmdk measures its list and scrolls the highlighted row; the overlay reads the motion preference.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => {};
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
});

afterEach(() => {
  act(() => paletteStore.close());
  cleanup();
});

/** Opens the palette and moves into the thread's actions page with Tab, as a user would. */
async function openThreadActions() {
  const app = await loadPluginApp(() => import("@/app"));
  const overlay = app.appOverlays.find((registration) => registration.id === "palette");
  if (!overlay) throw new Error("palette overlay is not registered");
  const archive = vi.fn(async () => {});
  const remove = vi.fn(async () => {});
  const targets: PluginThreadActionTarget[] = [];
  const slot = renderSlot(overlay, {}, {
    sidebarThreads: { status: "ready", threads: [thread], projects: [project] },
    threadActions: (target) => {
      targets.push(target);
      return [coreAction("bb--core/pin", async () => {}), coreAction("bb--core/archive", archive), coreAction("bb--core/delete", remove)];
    },
    sdk: { threads: { pin: async () => undefined as never, markRead: async () => undefined as never } },
    rpc: { get_bootstrap: () => bootstrap },
  });
  await act(async () => paletteStore.open());
  await screen.findByText("Fix login redirect");
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Tab" });
  await screen.findByText("Open in split");
  return { slot, archive, remove, targets };
}

describe("thread actions page", () => {
  it("pins through the bb SDK", async () => {
    const { slot } = await openThreadActions();
    fireEvent.click(screen.getByText("Pin"));
    await vi.waitFor(() => expect(slot.inspection.sdkCalls).toEqual([{ method: "threads.pin", args: [{ threadId: "th_1" }] }]));
  });

  it("marks an unread thread read through the bb SDK", async () => {
    const { slot } = await openThreadActions();
    fireEvent.click(screen.getByText("Mark as read"));
    await vi.waitFor(() => expect(slot.inspection.sdkCalls).toEqual([{ method: "threads.markRead", args: [{ threadId: "th_1" }] }]));
  });

  it("opens the thread in a split", async () => {
    const { slot } = await openThreadActions();
    fireEvent.click(screen.getByText("Open in split"));
    expect(slot.inspection.navigateCalls).toEqual([{ method: "toThread", threadId: "th_1", options: { split: true } }]);
  });

  it("copies the thread id through bb's clipboard", async () => {
    const { slot } = await openThreadActions();
    fireEvent.click(screen.getByText("Copy thread id"));
    await vi.waitFor(() => expect(slot.inspection.experimental_clipboardWrites).toEqual([{ text: "th_1" }]));
  });

  it("archives and deletes through bb's own thread actions", async () => {
    const first = await openThreadActions();
    expect(first.targets.at(-1)).toMatchObject({ id: "th_1", archivedAt: null });
    fireEvent.click(screen.getByText("Archive"));
    expect(first.archive).toHaveBeenCalledOnce();
    expect(first.remove).not.toHaveBeenCalled();
    cleanup();

    const second = await openThreadActions();
    fireEvent.click(screen.getByText("Delete"));
    expect(second.remove).toHaveBeenCalledOnce();
    expect(second.archive).not.toHaveBeenCalled();
  });
});
