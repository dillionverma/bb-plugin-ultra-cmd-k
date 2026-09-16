// The palette shell: one cmdk <Command> whose input is shared by every page,
// a page stack, prefix modes, and the keyboard contract:
//   ↑↓ move · ↵ run · Ctrl/Cmd+↵ secondary · → or Tab open sub-page
//   Esc clears the query, then pops the page, then closes · ⌫ on empty pops
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { toast } from "sonner";
import {
  experimental_useSidebarThreadActions,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { Command, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/Kbd";
import { errorMessage, PaletteApiProvider, type PaletteApi } from "@/components/PaletteContext";
import { RootPage } from "@/components/RootPage";
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
import { threadTitle } from "@/components/ThreadRow";
import type { Bootstrap, rpcContract } from "@/lib/contract";
import { scoreMatch } from "@/lib/fuzzy";
import { findBinding, relayBinding } from "@/lib/host-commands";
import { isMacPlatform, isModEnter } from "@/lib/hotkey";
import { afterClose, paletteStore } from "@/lib/palette-store";
import { parseQuery, type Action, type Page } from "@/lib/palette-types";
import { recentsStore } from "@/lib/recents";
import { cn } from "@/lib/utils";

/** Survives close/open so the second open renders instantly. */
let cachedBootstrap: Bootstrap | null = null;

const FREE_TEXT_PAGES = new Set<Page["kind"]>(["send", "cli", "output"]);

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

const MODE_CHIP: Record<string, string> = {
  commands: "Commands",
  threads: "Threads",
  projects: "Projects",
  skills: "Skills",
  cli: "bb",
  shortcuts: "Shortcuts",
};

const PLACEHOLDER: Record<string, string> = {
  root: "Search threads, commands, themes…  (> @ # / $ ?)",
  commands: "Search commands…",
  threads: "Search threads…",
  projects: "Search projects…",
  skills: "Search skills…",
  cli: "bb arguments, e.g. thread list",
  shortcuts: "Search shortcuts…",
};

export function Palette({ initialQuery, openNonce }: { initialQuery: string; openNonce: number }) {
  const rpc = useRpc<typeof rpcContract>();
  const nav = useBbNavigate();
  const threadActions = experimental_useSidebarThreadActions();
  const threads = experimental_useSidebarThreads();
  const bbContext = useBbContext();
  const isMac = useMemo(() => isMacPlatform(), []);

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(cachedBootstrap);
  const [query, setQuery] = useState(initialQuery);
  const [pages, setPages] = useState<Page[]>([]);
  const registry = useRef(new Map<string, Action>());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshBootstrap = useCallback(async () => {
    try {
      const next = await rpc.call("get_bootstrap", {});
      cachedBootstrap = next;
      setBootstrap(next);
      return next;
    } catch (error) {
      toast.error(`Ultra Cmd+K: ${errorMessage(error)}`);
      return null;
    }
  }, [rpc]);

  useEffect(() => {
    void refreshBootstrap();
    setQuery(initialQuery);
    setPages([]);
    // Focus after the overlay flips from hidden.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [openNonce, initialQuery, refreshBootstrap]);

  const page = pages[pages.length - 1] ?? null;
  const { mode, text } = page === null ? parseQuery(query) : { mode: "root" as const, text: query };

  const push = useCallback((next: Page) => {
    setPages((stack) => [...stack, next]);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
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
      threadActions,
      threads,
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
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;
          input.focus();
          input.setSelectionRange(value.length, value.length);
        });
      },
    }),
    [rpc, nav, threadActions, threads, bbContext, bootstrap, refreshBootstrap, isMac, push, pop, replace, relay],
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
  const shouldFilter = !freeText && mode !== "cli";
  const filter = useCallback(
    (value: string, _search: string, keywords?: string[]) =>
      scoreMatch(keywords && keywords.length > 0 ? keywords.join(" ") : value, text),
    [text],
  );

  const chips: string[] = page === null ? (mode === "root" ? [] : [MODE_CHIP[mode] ?? mode]) : pages.map((entry) => pageTitle(entry, api));
  const placeholder = page === null ? PLACEHOLDER[mode] : page.kind === "send" ? "Message…" : page.kind === "cli" ? PLACEHOLDER.cli : "Filter…";
  const pageKey = page === null ? `root:${mode}` : `${page.kind}:${JSON.stringify(page)}`;

  return (
    <PaletteApiProvider value={api}>
      <Command
        key={pageKey}
        loop
        shouldFilter={shouldFilter}
        filter={filter}
        onKeyDown={onKeyDown}
        className="rounded-xl bg-transparent"
        label="Ultra Cmd+K"
      >
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
          {bootstrap === null ? <Icon name="Loading" className="size-4 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
        </div>
        <CommandList ref={listRef} className="max-h-[min(62vh,440px)] scroll-py-1 p-1">
          {shouldFilter ? <CommandEmpty className="py-8 text-muted-foreground">No matches.</CommandEmpty> : null}
          {page === null ? (
            mode === "skills" ? (
              <SkillsPage />
            ) : mode === "cli" ? (
              <CliPage text={text} setQuery={api.setQuery} />
            ) : mode === "shortcuts" ? (
              <ShortcutsPage />
            ) : (
              <RootPage mode={mode} text={text} />
            )
          ) : page.kind === "themes" ? (
            <ThemesPage />
          ) : page.kind === "favicon" ? (
            <FaviconPage />
          ) : page.kind === "thread" ? (
            <ThreadActionsPage threadId={page.threadId} />
          ) : page.kind === "send" ? (
            <SendMessagePage threadId={page.threadId} text={query} />
          ) : page.kind === "project" ? (
            <ProjectPage projectId={page.projectId} />
          ) : page.kind === "plugins" ? (
            <PluginsPage />
          ) : page.kind === "plugin" ? (
            <PluginPage pluginId={page.pluginId} />
          ) : page.kind === "skills" ? (
            <SkillsPage />
          ) : page.kind === "shortcuts" ? (
            <ShortcutsPage />
          ) : page.kind === "cli" ? (
            <CliPage text={query} setQuery={api.setQuery} />
          ) : (
            <OutputPage title={page.title} result={page.result} />
          )}
        </CommandList>
        <footer
          className={cn(
            "flex h-8 items-center gap-3 border-t border-border/70 px-3 text-[11px] text-muted-foreground",
            "select-none",
          )}
        >
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
