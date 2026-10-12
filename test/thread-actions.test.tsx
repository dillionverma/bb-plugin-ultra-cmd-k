import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginThreadActionEntry,
  PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { bootstrapStore } from "@/lib/bootstrap-store";
import type { Bootstrap } from "@/lib/contract";
import { paletteStore } from "@/lib/palette-store";
import { recentsStore } from "@/lib/recents";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

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
  launcherRunning: false,
  plugins: [],
  hosts: [],
  primaryHostId: null,
};

function coreAction(key: string, run: () => Promise<void>, disabled: boolean): PluginThreadActionEntry {
  return { key, pluginId: "bb--core", group: "lifecycle", action: { label: key, icon: "Zap", run, disabled } };
}

type PaletteSetup = {
  bootstrap?: Partial<Bootstrap>;
  pin?: () => Promise<never>;
  offered?: readonly string[];
  disabled?: readonly string[];
};

beforeAll(() => {
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
  bootstrapStore.reset();
  recentsStore.clear();
  vi.clearAllMocks();
});

async function openPalette({
  bootstrap: overrides = {},
  pin = async () => undefined as never,
  offered = ["bb--core/pin", "bb--core/archive", "bb--core/delete"],
  disabled = [],
}: PaletteSetup = {}) {
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
      const runs = { "bb--core/pin": async () => {}, "bb--core/archive": archive, "bb--core/delete": remove };
      return Object.entries(runs)
        .filter(([key]) => offered.includes(key))
        .map(([key, run]) => coreAction(key, run, disabled.includes(key)));
    },
    sdk: { threads: { pin, markRead: async () => undefined as never } },
    rpc: { get_bootstrap: () => ({ ...bootstrap, ...overrides }) },
    context: { projectId: "pr_1" },
  });
  await act(async () => paletteStore.open());
  await screen.findByText("Fix login redirect");
  return { slot, archive, remove, targets };
}

async function openThreadActions(setup?: PaletteSetup) {
  const opened = await openPalette(setup);
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Tab" });
  await screen.findByText("Open in split");
  return opened;
}

describe("thread actions page", () => {
  it("pins through the bb SDK", async () => {
    const { slot } = await openThreadActions();
    fireEvent.click(screen.getByText("Pin"));
    await vi.waitFor(() => expect(slot.inspection.sdkCalls).toEqual([{ method: "threads.pin", args: [{ threadId: "th_1" }] }]));
  });

  it("reports a failed pin instead of claiming success", async () => {
    await openThreadActions({
      pin: async () => {
        throw new Error("offline");
      },
    });
    fireEvent.click(screen.getByText("Pin"));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("offline"));
    expect(toast.success).not.toHaveBeenCalled();
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
    expect(toast.success).not.toHaveBeenCalled();
    expect(first.remove).not.toHaveBeenCalled();
    cleanup();

    const second = await openThreadActions();
    fireEvent.click(screen.getByText("Delete"));
    expect(second.remove).toHaveBeenCalledOnce();
    expect(second.archive).not.toHaveBeenCalled();
  });

  it("leaves out Archive and Delete when bb does not offer them for the thread", async () => {
    await openThreadActions({ offered: ["bb--core/pin"] });
    expect(screen.queryByText("Archive")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows Archive and Delete disabled when bb disables them", async () => {
    const { archive, remove } = await openThreadActions({ disabled: ["bb--core/archive", "bb--core/delete"] });
    for (const title of ["Archive", "Delete"]) {
      expect(screen.getByText(title).closest("[cmdk-item]")?.getAttribute("data-disabled")).toBe("true");
      fireEvent.click(screen.getByText(title));
    }
    expect(archive).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("new thread", () => {
  it("opens bb's new-thread screen in the current project when Ultra Launcher is not running", async () => {
    const { slot } = await openPalette();
    fireEvent.click(screen.getByText("New thread"));
    expect(slot.inspection.navigateCalls).toEqual([{ method: "toCompose", options: { projectId: "pr_1", focusPrompt: true } }]);
  });

  it("hands off to Ultra Launcher when it is running", async () => {
    const launcherOpened = vi.fn();
    window.addEventListener("ultra-launcher:open", launcherOpened);
    try {
      const { slot } = await openPalette({ bootstrap: { launcherRunning: true } });
      await screen.findByText("Ultra Launcher");
      fireEvent.click(screen.getByText("New thread"));
      expect(launcherOpened).toHaveBeenCalledOnce();
      expect(slot.inspection.navigateCalls).toEqual([]);
    } finally {
      window.removeEventListener("ultra-launcher:open", launcherOpened);
    }
  });
});
