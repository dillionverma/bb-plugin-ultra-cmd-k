// The palette shell: one cmdk <Command> whose input is shared by every page,
// a page stack, prefix modes, and the keyboard contract:
//   ↑↓ move · ↵ run · Ctrl/Cmd+↵ secondary · → or Tab open sub-page
//   Esc clears the query, then pops the page, then closes · ⌫ on empty pops
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { toast } from "sonner";
import {
  experimental_useProviders,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { Command, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";
import { Kbd } from "@/components/Kbd";
import { errorMessage, PaletteApiProvider, type PaletteApi, type VirtualNav } from "@/components/PaletteContext";
import { RootPage } from "@/components/RootPage";
import { ThemePreview } from "@/components/ThemePreview";
import { CliPage } from "@/components/pages/CliPage";
import { FaviconPage } from "@/components/pages/FaviconPage";
import { OutputPage } from "@/components/pages/OutputPage";
import { PluginPage, PluginsPage } from "@/components/pages/PluginsPage";
import { ProjectPage } from "@/components/pages/ProjectPage";
import { SendMessagePage } from "@/components/pages/SendMessagePage";
import { ShortcutsPage } from "@/components/pages/ShortcutsPage";
import { SkillsPage } from "@/components/pages/SkillsPage";
import { ThemesPage } from "@/components/pages/ThemesPage";
import { ThreadActionsPage } from "@/components/pages/ThreadActionsPage";
import { bootstrapStore, useBootstrap } from "@/lib/bootstrap-store";
import type { rpcContract } from "@/lib/contract";
import { scoreMatch } from "@/lib/fuzzy";
import { findBinding, relayBinding } from "@/lib/host-commands";
import { isMacPlatform, isModEnter } from "@/lib/hotkey";
import { afterClose, paletteStore } from "@/lib/palette-store";
import { parseQuery, type Action, type Page, type PrefixMode } from "@/lib/palette-types";
import { recentsStore } from "@/lib/recents";
import { threadTitle } from "@/lib/thread-search";

/** Pages where the input is free text, not a filter. */
const FREE_TEXT_PAGES = new Set<Page["kind"]>(["send", "cli", "output"]);

/** The windowed list's keys (cmdk's vim bindings included), else null. */
function virtualNavigation(event: ReactKeyboardEvent, nav: VirtualNav): (() => void) | null {
  switch (event.key) {
    case "ArrowDown":
      return () => nav.move(1);
    case "ArrowUp":
      return () => nav.move(-1);
    case "Home":
      return () => nav.jump("first");
    case "End":
      return () => nav.jump("last");
    case "PageDown":
      return () => nav.page(1);
    case "PageUp":
      return () => nav.page(-1);
    case "n":
    case "j":
      return event.ctrlKey ? () => nav.move(1) : null;
    case "p":
    case "k":
      return event.ctrlKey ? () => nav.move(-1) : null;
    default:
      return null;
  }
}

const MODE_CHIP: Record<PrefixMode, string | null> = {
  root: null,
  commands: "Commands",
  threads: "Threads",
  projects: "Projects",
  skills: "Skills",
  cli: "bb",
  shortcuts: "Shortcuts",
};

const PLACEHOLDER: Record<PrefixMode, string> = {
  root: "Search threads, commands, themes…  (> @ # / $ ?)",
  commands: "Search commands…",
  threads: "Search threads…",
  projects: "Search projects…",
  skills: "Search skills…",
  cli: "bb arguments, e.g. thread list",
  shortcuts: "Search shortcuts…",
};

function pageTitle(page: Page, api: PaletteApi): string {
  switch (page.kind) {
    case "themes":
      return "Theme";
    case "favicon":
      return "Favicon";
    case "thread": {
      const thread = api.threads.threads.find((entry) => entry.id === page.threadId);
      return thread ? threadTitle(thread) : "Thread";
    }
    case "send":
      return "Message";
    case "project":
      return api.threads.projects.find((entry) => entry.id === page.projectId)?.name ?? "Project";
    case "plugins":
      return "Plugins";
    case "plugin":
      return api.bootstrap?.plugins.find((entry) => entry.id === page.pluginId)?.name ?? "Plugin";
    case "skills":
      return "Skills";
    case "shortcuts":
      return "Shortcuts";
    case "cli":
      return "bb";
    case "output":
      return page.title;
  }
}

function PageView({ page, query, setQuery }: { page: Page; query: string; setQuery: (value: string) => void }) {
  switch (page.kind) {
    case "themes":
      return <ThemesPage />;
    case "favicon":
      return <FaviconPage />;
    case "thread":
      return <ThreadActionsPage threadId={page.threadId} />;
    case "send":
      return <SendMessagePage threadId={page.threadId} text={query} />;
    case "project":
      return <ProjectPage projectId={page.projectId} />;
    case "plugins":
      return <PluginsPage />;
    case "plugin":
      return <PluginPage pluginId={page.pluginId} />;
    case "skills":
      return <SkillsPage />;
    case "shortcuts":
      return <ShortcutsPage />;
    case "cli":
      return <CliPage text={query} setQuery={setQuery} />;
    case "output":
      return <OutputPage title={page.title} result={page.result} />;
  }
}

function ModeView({ mode, text, setQuery }: { mode: PrefixMode; text: string; setQuery: (value: string) => void }) {
  switch (mode) {
    case "skills":
      return <SkillsPage />;
    case "cli":
      return <CliPage text={text} setQuery={setQuery} />;
    case "shortcuts":
      return <ShortcutsPage />;
    default:
      return <RootPage mode={mode} text={text} />;
  }
}

export function Palette({ initialQuery, openNonce }: { initialQuery: string; openNonce: number }) {
  const rpc = useRpc<typeof rpcContract>();
  const nav = useBbNavigate();
  const threads = experimental_useSidebarThreads();
  const providerState = experimental_useProviders();
  const bbContext = useBbContext();
  const isMac = useMemo(() => isMacPlatform(), []);

  // Shared across opens and windows-in-tree; kept fresh by realtime (see
  // components/BootstrapSync.tsx), so an open after the first paints at once.
  const bootstrap = useBootstrap();
  const [query, setQuery] = useState(initialQuery);
  const [pages, setPages] = useState<Page[]>([]);
  // cmdk's highlight, controlled only while a page windows its rows.
  const [selected, setSelected] = useState("");
  const virtualNav = useRef<VirtualNav | null>(null);
  const registry = useRef(new Map<string, Action>());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const providers = useMemo(
    () => new Map(providerState.providers.map((provider) => [provider.id, provider])),
    [providerState.providers],
  );

  const fetchBootstrap = useCallback(() => rpc.call("get_bootstrap", {}), [rpc]);
  const refreshBootstrap = useCallback(async () => {
    try {
      return await bootstrapStore.refresh(fetchBootstrap);
    } catch (error) {
      toast.error(`Ultra Cmd+K: ${errorMessage(error)}`);
      return null;
    }
  }, [fetchBootstrap]);

  useEffect(() => {
    void bootstrapStore.ensureFresh(fetchBootstrap).catch((error: unknown) => toast.error(`Ultra Cmd+K: ${errorMessage(error)}`));
    setQuery(initialQuery);
    setPages([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [openNonce, initialQuery, fetchBootstrap]);

  const page = pages[pages.length - 1] ?? null;
  const { mode, text } = page === null ? parseQuery(query) : { mode: "root" as const, text: query };
  /** `@` mode windows its rows; the shell then controls cmdk's highlight (see VirtualThreadList). */
  const virtual = page === null && mode === "threads";

  const focusInput = useCallback((caret?: number) => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (caret !== undefined) input.setSelectionRange(caret, caret);
    });
  }, []);
  const push = useCallback(
    (next: Page) => {
      setPages((stack) => [...stack, next]);
      setQuery("");
      focusInput();
    },
    [focusInput],
  );
  const pop = useCallback(() => {
    setPages((stack) => stack.slice(0, -1));
    setQuery("");
  }, []);
  const replace = useCallback((next: Page) => {
    setPages((stack) => [...stack.slice(0, -1), next]);
    setQuery("");
  }, []);

  const relay = useCallback(
    async (commandId: string) => {
      const binding = bootstrap ? findBinding(bootstrap.keybindings, commandId) : null;
      if (!binding) return false;
      paletteStore.close();
      await afterClose();
      return relayBinding(binding, isMac);
    },
    [bootstrap, isMac],
  );

  const api = useMemo<PaletteApi>(
    () => ({
      rpc,
      nav,
      threads,
      providers,
      bbContext,
      bootstrap,
      refreshBootstrap,
      isMac,
      close: () => paletteStore.close(),
      push,
      pop,
      replace,
      record: (id) => recentsStore.record(id),
      relay,
      reportError: (error) => toast.error(errorMessage(error)),
      registerActions: (actions) => {
        for (const action of actions) registry.current.set(action.id, action);
        return () => {
          for (const action of actions) {
            if (registry.current.get(action.id) === action) registry.current.delete(action.id);
          }
        };
      },
      setQuery: (value) => {
        setQuery(value);
        focusInput(value.length);
      },
      select: setSelected,
      virtualNav,
    }),
    [rpc, nav, threads, providers, bbContext, bootstrap, refreshBootstrap, isMac, push, pop, replace, relay, focusInput],
  );

  const selectedAction = (): Action | null => {
    const raw = listRef.current
      ?.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]')
      ?.getAttribute("data-action-id");
    if (!raw) return null;
    const id = raw.startsWith("recent:") ? raw.slice("recent:".length) : raw;
    return registry.current.get(id) ?? null;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query !== "") setQuery("");
      else if (page !== null) pop();
      else paletteStore.close();
      return;
    }
    if (event.key === "Backspace" && query === "" && page !== null) {
      event.preventDefault();
      pop();
      return;
    }
    // A windowed list moves its own highlight; preventDefault keeps cmdk's
    // DOM walk (which only sees mounted rows) out of it.
    const navigate = virtualNav.current ? virtualNavigation(event, virtualNav.current) : null;
    if (navigate) {
      event.preventDefault();
      navigate();
      return;
    }
    if (isModEnter(event.nativeEvent, isMac)) {
      const action = selectedAction();
      if (action?.secondary) {
        event.preventDefault();
        void action.secondary();
      }
      return;
    }
    if (event.key === "ArrowRight" || event.key === "Tab") {
      const input = inputRef.current;
      const atEnd = !input || input.selectionStart === input.value.length;
      if (!atEnd && event.key === "ArrowRight") return;
      const action = selectedAction();
      if (action?.page) {
        event.preventDefault();
        push(action.page);
      } else if (event.key === "Tab") {
        event.preventDefault();
      }
    }
  };

  const freeText = page !== null && FREE_TEXT_PAGES.has(page.kind);
  // Windowed rows are ranked before they mount (lib/thread-search), not by cmdk.
  const shouldFilter = !freeText && mode !== "cli" && !virtual;
  const filter = useCallback(
    (value: string, _search: string, keywords?: string[]) =>
      scoreMatch(keywords && keywords.length > 0 ? keywords.join(" ") : value, text),
    [text],
  );

  const chips = page === null ? [MODE_CHIP[mode]].filter((chip): chip is string => chip !== null) : pages.map((entry) => pageTitle(entry, api));
  const placeholder = page === null ? PLACEHOLDER[mode] : page.kind === "send" ? "Message…" : page.kind === "cli" ? PLACEHOLDER.cli : "Filter…";
  const pageKey = page === null ? `root:${mode}` : `${page.kind}:${JSON.stringify(page)}`;

  return (
    <PaletteApiProvider value={api}>
      <Command
        key={pageKey}
        loop
        shouldFilter={shouldFilter}
        filter={filter}
        value={virtual ? selected : undefined}
        onValueChange={virtual ? setSelected : undefined}
        onKeyDown={onKeyDown}
        className="rounded-xl bg-transparent"
        label="Ultra Cmd+K"
      >
        <ThemePreview />
        <div className="flex items-center gap-2 border-b border-border/70 px-3">
          {chips.length > 0 ? (
            <div className="flex shrink-0 items-center gap-1">
              {chips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="inline-flex h-6 max-w-40 items-center truncate rounded-md bg-state-active px-2 text-xs font-medium text-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
            autoFocus
            className="h-12 text-[15px]"
          />
        </div>
        <CommandList ref={listRef} className="max-h-[min(62vh,440px)] scroll-py-1 p-1">
          {shouldFilter ? <CommandEmpty className="py-8 text-muted-foreground">No matches.</CommandEmpty> : null}
          {page === null ? (
            <ModeView mode={mode} text={text} setQuery={api.setQuery} />
          ) : (
            <PageView page={page} query={query} setQuery={api.setQuery} />
          )}
        </CommandList>
        <footer className="flex h-8 select-none items-center gap-3 border-t border-border/70 px-3 text-[11px] text-muted-foreground">
          <Hint keys={["↑", "↓"]} label="navigate" />
          <Hint keys={["↵"]} label="select" />
          <Hint keys={[isMac ? "⌘" : "Ctrl", "↵"]} label="split / alt" />
          <Hint keys={["→"]} label="more" />
          <Hint keys={["esc"]} label={query !== "" ? "clear" : page !== null ? "back" : "close"} />
          <span className="ml-auto truncate">
            {bootstrap?.hotkey.state === "taken" ? "bb still owns ⌘K — see plugin settings" : "Ultra Cmd+K"}
          </span>
        </footer>
      </Command>
    </PaletteApiProvider>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Kbd keys={keys} className="ml-0" />
      <span>{label}</span>
    </span>
  );
}
