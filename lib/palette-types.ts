import type { RunResult } from "./contract";
import type { GlyphName } from "./glyphs";

/** A sub-screen pushed on top of the root list. */
export type Page =
  | { kind: "themes" }
  | { kind: "favicon" }
  | { kind: "thread"; threadId: string }
  | { kind: "send"; threadId: string }
  | { kind: "project"; projectId: string }
  | { kind: "plugins" }
  | { kind: "plugin"; pluginId: string }
  | { kind: "skills" }
  | { kind: "shortcuts" }
  | { kind: "cli" }
  | { kind: "output"; title: string; result: RunResult };

/** Query prefixes that narrow the root list to one kind of row. */
export const PREFIX_MODES = {
  ">": "commands",
  "@": "threads",
  "#": "projects",
  "/": "skills",
  "$": "cli",
  "?": "shortcuts",
} as const;
export type PrefixMode = (typeof PREFIX_MODES)[keyof typeof PREFIX_MODES] | "root";

export function parseQuery(raw: string): { mode: PrefixMode; text: string } {
  const first = raw[0];
  if (first !== undefined && first in PREFIX_MODES) {
    return { mode: PREFIX_MODES[first as keyof typeof PREFIX_MODES], text: raw.slice(1).trimStart() };
  }
  return { mode: "root", text: raw };
}

export type ActionRun = () => void | Promise<void>;

/** One selectable row. `secondary` answers Ctrl/Cmd+Enter; `page` answers → / Tab. */
export type Action = {
  id: string;
  title: string;
  subtitle?: string;
  /** Hugeicons glyph (see lib/glyphs.ts); falls back to `icon`. */
  glyph?: GlyphName;
  icon?: string;
  group: string;
  keywords?: string[];
  /** Overrides the default "title + subtitle + keywords" search text. */
  searchText?: string[];
  shortcut?: string[];
  disabled?: boolean;
  disabledReason?: string;
  run: ActionRun;
  secondary?: ActionRun;
  secondaryHint?: string;
  page?: Page;
};

export const GROUP_ORDER = [
  "Recent",
  "Current thread",
  "Threads",
  "Projects",
  "Appearance",
  "Agent & CLI",
  "Layout",
  "App",
  "Model",
  "Composer",
] as const;
