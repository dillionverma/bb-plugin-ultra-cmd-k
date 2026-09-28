// Shared wire contract between app.tsx (type-only import), server.ts and
// host.ts. Every schema here runs at a trust boundary: frontend → server RPC
// and server → host-daemon RPC.
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const shortcutSchema = z
  .object({
    key: z.string(),
    mod: z.boolean(),
    meta: z.boolean(),
    control: z.boolean(),
    alt: z.boolean(),
    shift: z.boolean(),
  })
  .nullable();
export type Shortcut = z.infer<typeof shortcutSchema>;

/** One effective host keybinding, as `bb.sdk.system.config().keybindings` reports it. */
export const keybindingSchema = z.object({
  command: z.string(),
  desktopOnly: z.boolean(),
  shortcut: shortcutSchema,
  when: z.object({ all: z.array(z.string()), none: z.array(z.string()) }),
});
export type Keybinding = z.infer<typeof keybindingSchema>;

export const faviconColorSchema = z.enum([
  "default",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
]);
export type FaviconColor = z.infer<typeof faviconColorSchema>;
export const FAVICON_COLORS = faviconColorSchema.options;

/** A theme's accent over its canvas, as CSS colour values (see lib/theme-swatch.ts). */
export const swatchSchema = z.object({ canvas: z.string(), primary: z.string() });
export type Swatch = z.infer<typeof swatchSchema>;
export const themeSwatchSchema = z.object({ light: swatchSchema, dark: swatchSchema });
export type ThemeSwatch = z.infer<typeof themeSwatchSchema>;

export const themeEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  kind: z.enum(["builtin", "custom", "plugin"]),
  /** Null when the theme's CSS declares no usable anchors; the row draws a neutral dot. */
  swatch: themeSwatchSchema.nullable(),
});
export type ThemeEntry = z.infer<typeof themeEntrySchema>;

export const themeStateSchema = z.object({
  activeId: z.string(),
  faviconColor: faviconColorSchema,
  entries: z.array(themeEntrySchema),
});
export type ThemeState = z.infer<typeof themeStateSchema>;

export const hotkeyStatusSchema = z.object({
  state: z.enum(["free", "taken"]),
  reason: z.enum(["claimed", "not-bound", "user-override", "host-default"]),
  description: z.string(),
});
export type HotkeyStatus = z.infer<typeof hotkeyStatusSchema>;

export const pluginEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  status: z.string(),
});
export type PluginEntry = z.infer<typeof pluginEntrySchema>;

export const skillEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  scope: z.string(),
});
export type SkillEntry = z.infer<typeof skillEntrySchema>;

export const hostEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["connected", "disconnected"]),
});
export type HostEntry = z.infer<typeof hostEntrySchema>;

export const bootstrapSchema = z.object({
  hotkey: hotkeyStatusSchema,
  keybindings: z.array(keybindingSchema),
  theme: themeStateSchema,
  launcherInstalled: z.boolean(),
  plugins: z.array(pluginEntrySchema),
  hosts: z.array(hostEntrySchema),
  primaryHostId: z.string().nullable(),
});
export type Bootstrap = z.infer<typeof bootstrapSchema>;

/**
 * Realtime channel the server publishes on whenever something the bootstrap
 * is built from changes (keybindings, theme, plugins, hosts). The payload is
 * a signal, not the data: every window refetches once per burst.
 */
export const BOOTSTRAP_CHANNEL = "bootstrap";
export type BootstrapSignal = { reasons: string[]; at: number };
export function isBootstrapSignal(payload: unknown): payload is BootstrapSignal {
  if (typeof payload !== "object" || payload === null) return false;
  const { reasons, at } = payload as Record<string, unknown>;
  return Array.isArray(reasons) && reasons.every((reason) => typeof reason === "string") && typeof at === "number";
}

export const threadActionSchema = z.enum([
  "stop",
  "fork",
  "compact",
  "archive",
  "unarchive",
  "markRead",
  "markUnread",
  "pin",
  "unpin",
]);
export type ThreadAction = z.infer<typeof threadActionSchema>;

export const runResultSchema = z.object({
  code: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  truncated: z.boolean(),
  durationMs: z.number(),
});
export type RunResult = z.infer<typeof runResultSchema>;

export const MAX_BB_ARGS = 64;
export const MAX_ARG_LENGTH = 4096;
/** Arguments for the fixed `bb` executable: no shell, no newlines, bounded. */
export const bbArgsSchema = z
  .array(z.string().max(MAX_ARG_LENGTH).refine((arg) => !/[\r\n\0]/.test(arg), "Arguments cannot contain newlines."))
  .min(1)
  .max(MAX_BB_ARGS);

export const rpcContract = defineRpcContract({
  get_bootstrap: { input: z.object({}), output: bootstrapSchema },
  set_theme: {
    input: z.object({ themeId: z.string().min(1) }),
    output: z.object({ themeId: z.string(), faviconColor: faviconColorSchema }),
  },
  set_favicon: {
    input: z.object({ faviconColor: faviconColorSchema }),
    output: z.object({ themeId: z.string(), faviconColor: faviconColorSchema }),
  },
  list_skills: {
    input: z.object({ projectId: z.string(), environmentId: z.string().nullable() }),
    output: z.object({ skills: z.array(skillEntrySchema) }),
  },
  thread_action: {
    input: z.object({ threadId: z.string().min(1), action: threadActionSchema }),
    output: z.object({ ok: z.boolean(), threadId: z.string().optional() }),
  },
  send_message: {
    input: z.object({ threadId: z.string().min(1), text: z.string().trim().min(1).max(20_000) }),
    output: z.object({ ok: z.boolean() }),
  },
  plugin_action: {
    input: z.object({ pluginId: z.string().min(1), action: z.enum(["enable", "disable", "reload"]) }),
    output: z.object({ ok: z.boolean() }),
  },
  run_bb: {
    input: z.object({ args: bbArgsSchema, hostId: z.string().optional() }),
    output: runResultSchema,
  },
  hotkey: {
    input: z.object({ action: z.enum(["status", "claim", "release"]) }),
    output: hotkeyStatusSchema,
  },
});

/** Server → host-daemon contract (host.ts). */
export const hostContract = defineRpcContract({
  run_bb: { input: z.object({ args: bbArgsSchema }), output: runResultSchema },
});
