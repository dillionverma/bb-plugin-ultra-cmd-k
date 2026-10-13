// Host command catalog + keystroke relay.
//
// bb exposes no API for a plugin to invoke its built-in commands (open
// Settings, toggle sidebar, open terminal, …). What it does expose is the
// keybinding table, and its shortcut layer is a plain `window` keydown
// listener that matches modifiers + key against that table and dispatches the
// command — with no `isTrusted` check. So the palette closes itself (so the
// host's `modalOpen` context clears), then dispatches a synthetic keydown
// carrying the command's *live* binding. Rebinding a shortcut in Settings →
// Keyboard is picked up automatically because bindings are read from
// `system.config()` on every open.
import type { Keybinding, Shortcut } from "./contract";
import type { GlyphName } from "./glyphs";

type HostCommandGroup = "Threads" | "Layout" | "Model" | "Composer" | "App";

type HostCommandSpec = {
  id: string;
  title: string;
  group: HostCommandGroup;
  glyph: GlyphName;
  keywords?: string[];
};

export const HOST_COMMANDS: readonly HostCommandSpec[] = [
  { id: "settings.open", title: "Open settings", group: "App", glyph: "settings", keywords: ["preferences", "config", "appearance", "keyboard", "providers"] },
  { id: "settings.openServers", title: "Open servers settings", group: "App", glyph: "servers", keywords: ["machines", "hosts", "remote"] },
  { id: "app.back", title: "Back to app", group: "App", glyph: "back", keywords: ["return", "leave settings"] },
  { id: "notifications.open", title: "Open notifications", group: "App", glyph: "notifications", keywords: ["inbox", "attention"] },
  { id: "window.new", title: "New window", group: "App", glyph: "window" },
  { id: "logs.openServerDaemon", title: "Open server logs", group: "App", glyph: "logs", keywords: ["daemon", "debug"] },
  { id: "palette.open", title: "Open bb quick palette", group: "App", glyph: "bbPalette", keywords: ["builtin", "native", "search"] },
  { id: "file.quickOpen", title: "Quick open file", group: "App", glyph: "file", keywords: ["go to file", "search files"] },
  { id: "workspace.openPreferred", title: "Open workspace in editor", group: "App", glyph: "openExternal", keywords: ["vscode", "cursor", "finder", "terminal app"] },

  { id: "thread.new", title: "New thread (bb screen)", group: "Threads", glyph: "newThread", keywords: ["compose", "start"] },
  { id: "thread.search", title: "Search threads (bb)", group: "Threads", glyph: "search" },
  { id: "thread.rename", title: "Rename thread", group: "Threads", glyph: "rename", keywords: ["title"] },
  { id: "thread.archive", title: "Archive thread", group: "Threads", glyph: "archive" },
  { id: "thread.previous", title: "Previous thread", group: "Threads", glyph: "up" },
  { id: "thread.next", title: "Next thread", group: "Threads", glyph: "down" },

  { id: "sidebar.toggle", title: "Toggle sidebar", group: "Layout", glyph: "sidebar", keywords: ["thread list", "hide", "show"] },
  { id: "panel.toggle", title: "Toggle side panel", group: "Layout", glyph: "panel", keywords: ["right panel", "files", "browser"] },
  { id: "panel.newTab", title: "New panel tab", group: "Layout", glyph: "newTab" },
  { id: "panel.reopenClosedTab", title: "Reopen closed tab", group: "Layout", glyph: "reopen" },
  { id: "panel.close", title: "Close panel tab", group: "Layout", glyph: "close" },
  { id: "terminal.open", title: "Open terminal", group: "Layout", glyph: "terminal", keywords: ["shell", "console"] },
  { id: "diff.toggle", title: "Toggle diff", group: "Layout", glyph: "diff", keywords: ["changes", "git", "review"] },
  { id: "pane.maximize.toggle", title: "Maximize pane", group: "Layout", glyph: "maximize", keywords: ["split", "focus"] },
  { id: "pane.close", title: "Close pane", group: "Layout", glyph: "close", keywords: ["split"] },
  { id: "pane.focus.next", title: "Focus next pane", group: "Layout", glyph: "right", keywords: ["split"] },
  { id: "pane.focus.previous", title: "Focus previous pane", group: "Layout", glyph: "left", keywords: ["split"] },

  { id: "composer.focus", title: "Focus composer", group: "Composer", glyph: "composer", keywords: ["prompt", "input", "editor"] },
  { id: "modelPicker.toggle", title: "Open model picker", group: "Model", glyph: "model", keywords: ["provider", "reasoning", "effort"] },
  { id: "modelPicker.cycleModel", title: "Next model", group: "Model", glyph: "down" },
  { id: "modelPicker.cycleModelBackward", title: "Previous model", group: "Model", glyph: "up" },
  { id: "modelPicker.cycleProvider", title: "Next provider", group: "Model", glyph: "right", keywords: ["claude", "codex", "agent"] },
  { id: "modelPicker.cycleProviderBackward", title: "Previous provider", group: "Model", glyph: "left" },
  { id: "modelPicker.cycleReasoning", title: "Raise reasoning effort", group: "Model", glyph: "up", keywords: ["thinking", "effort"] },
  { id: "modelPicker.cycleReasoningBackward", title: "Lower reasoning effort", group: "Model", glyph: "down", keywords: ["thinking", "effort"] },
];

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && (window as { bbDesktop?: unknown }).bbDesktop != null;
}

/** The effective binding for a command on this client, or null if unbound here. */
export function findBinding(keybindings: readonly Keybinding[], commandId: string): Keybinding | null {
  const isDesktop = isDesktopApp();
  const candidates = keybindings.filter(
    (binding) => binding.command === commandId && binding.shortcut !== null && (!binding.desktopOnly || isDesktop),
  );
  // Desktop-specific rows win on desktop; otherwise the web binding.
  return candidates.find((binding) => binding.desktopOnly === isDesktop) ?? candidates[0] ?? null;
}

const CODE_BY_KEY: Record<string, string> = {
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  "\\": "Backslash",
  "[": "BracketLeft",
  "]": "BracketRight",
  "`": "Backquote",
  ";": "Semicolon",
  "'": "Quote",
  "-": "Minus",
  "=": "Equal",
  " ": "Space",
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
};

export function codeForKey(key: string): string {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return CODE_BY_KEY[key.toLowerCase()] ?? CODE_BY_KEY[key] ?? key;
}

/** Build the keydown init the host's matcher expects for a stored shortcut. */
export function keyboardEventInit(shortcut: NonNullable<Shortcut>, isMac: boolean): KeyboardEventInit {
  const letter = /^[a-z]$/i.test(shortcut.key);
  const key = letter ? (shortcut.shift ? shortcut.key.toUpperCase() : shortcut.key.toLowerCase()) : shortcut.key;
  return {
    key,
    code: codeForKey(shortcut.key),
    metaKey: shortcut.meta || (shortcut.mod && isMac),
    ctrlKey: shortcut.control || (shortcut.mod && !isMac),
    altKey: shortcut.alt,
    shiftKey: shortcut.shift,
    bubbles: true,
    cancelable: true,
  };
}

/**
 * Dispatch the command's shortcut as a synthetic keydown on document.body.
 * Returns true when the host handled it (it calls preventDefault on a match).
 * Call only after the palette has rendered closed and inert.
 */
export function relayBinding(binding: Keybinding, isMac: boolean): boolean {
  if (binding.shortcut === null) return false;
  const event = new KeyboardEvent("keydown", keyboardEventInit(binding.shortcut, isMac));
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

const MAC_GLYPHS: Record<string, string> = {
  mod: "⌘",
  meta: "⌘",
  control: "⌃",
  alt: "⌥",
  shift: "⇧",
};
const KEY_GLYPHS: Record<string, string> = {
  enter: "↵",
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  tab: "⇥",
  " ": "Space",
};

/** Human shortcut: ["⌘", "⇧", "P"] on mac, ["Ctrl", "Shift", "P"] elsewhere. */
export function formatShortcut(shortcut: NonNullable<Shortcut>, isMac: boolean): string[] {
  const parts: string[] = [];
  if (shortcut.control) parts.push(isMac ? MAC_GLYPHS.control! : "Ctrl");
  if (shortcut.alt) parts.push(isMac ? MAC_GLYPHS.alt! : "Alt");
  if (shortcut.shift) parts.push(isMac ? MAC_GLYPHS.shift! : "Shift");
  if (shortcut.mod) parts.push(isMac ? MAC_GLYPHS.mod! : "Ctrl");
  if (shortcut.meta) parts.push(isMac ? MAC_GLYPHS.meta! : "Win");
  const key = shortcut.key;
  parts.push(KEY_GLYPHS[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key));
  return parts;
}
