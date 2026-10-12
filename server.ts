// bb-plugin-ultra-cmd-k — backend entry.
//
// Three jobs:
//
// 1. Own Ctrl/Cmd+K. bb binds `palette.open` to Mod+K and, in the desktop
//    app, Electron consumes that accelerator before the renderer ever sees
//    the keydown. The plugin relocates `palette.open` to Mod+Shift+P (bb's
//    documented default for the quick palette) via a keybinding override,
//    remembers what it displaced, and puts it back on release.
// 2. Serve the palette's data and mutations over RPC: theme catalog and
//    selection, thread actions, plugin actions, skills, and `bb …` execution
//    (delegated to host.ts on an enrolled host).
// 3. `bb ultra-cmd-k status|claim|release|themes|theme|run …` for agents and
//    shells.
import { type BbPluginApi } from "@get-bb/plugin-sdk";
import {
  BOOTSTRAP_CHANNEL,
  hostContract,
  rpcContract,
  type Bootstrap,
  type BootstrapSignal,
  type FaviconColor,
  type HotkeyStatus,
  type Shortcut,
  type ThemeEntry,
} from "./lib/contract";
import { BUILTIN_SWATCHES, parseThemeSwatch } from "./lib/theme-swatch";

// --- Hotkey takeover -------------------------------------------------------

const HOST_COMMAND = "palette.open" as const;
/** bb's documented default for the quick palette; keeps it reachable. */
const RELOCATED_SHORTCUT = {
  key: "p",
  mod: true,
  meta: false,
  control: false,
  alt: false,
  shift: true,
} as const;
const CLAIM_KEY = "hotkey.claimed";
/** The override we displaced (if any), restored on release. */
const DISPLACED_KEY = "hotkey.displacedOverride";

type Override = { command: typeof HOST_COMMAND; shortcut: Shortcut };

function isModK(shortcut: Shortcut): boolean {
  return (
    shortcut !== null &&
    shortcut.key.toLowerCase() === "k" &&
    shortcut.mod &&
    !shortcut.shift &&
    !shortcut.alt &&
    !shortcut.control &&
    !shortcut.meta
  );
}

function describe(status: Omit<HotkeyStatus, "description">): string {
  switch (`${status.state}/${status.reason}`) {
    case "free/claimed":
      return "Ctrl/Cmd+K opens Ultra Cmd+K (bb's quick palette moved to Mod+Shift+P by this plugin).";
    case "free/not-bound":
      return "Ctrl/Cmd+K opens Ultra Cmd+K (bb does not bind it).";
    case "free/user-override":
      return "Ctrl/Cmd+K opens Ultra Cmd+K (you rebound bb's quick palette yourself).";
    case "taken/host-default":
      return "bb's quick palette still owns Ctrl/Cmd+K; run `bb ultra-cmd-k claim`.";
    case "taken/user-override":
      return "Your own override binds bb's quick palette to Ctrl/Cmd+K; run `bb ultra-cmd-k claim` to relocate it.";
    default:
      return `${status.state} (${status.reason})`;
  }
}

/** bb's built-in palettes are not reported by `theme.catalog()`. */
const BUILTIN_THEME_INFO: ReadonlyArray<Pick<ThemeEntry, "id" | "name" | "description">> = [
  { id: "default", name: "Default", description: "The standard bb look" },
  { id: "nord", name: "Nord", description: "Cool, muted arctic blues" },
  { id: "dracula", name: "Dracula", description: "Dark, high-contrast purple and pink" },
  { id: "solarized", name: "Solarized", description: "Balanced light and dark" },
  { id: "gruvbox", name: "Gruvbox", description: "Warm retro earth tones" },
  { id: "catppuccin", name: "Catppuccin", description: "Soothing pastel" },
];
const BUILTIN_THEMES: readonly ThemeEntry[] = BUILTIN_THEME_INFO.map((entry) => ({
  ...entry,
  kind: "builtin",
  swatch: BUILTIN_SWATCHES[entry.id] ?? null,
}));

/** System changes that invalidate something the bootstrap was built from. */
const BOOTSTRAP_TRIGGERS: ReadonlySet<string> = new Set(["config-changed", "ui-preferences-changed", "plugins-changed"]);
/** Coalesce a burst of changes (a theme preview scrub, a plugin reload) into one signal. */
const SIGNAL_COALESCE_MS = 150;


export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");

  const settings = bb.settings.define({
    takeOverCmdK: {
      type: "boolean",
      label: "Take over Ctrl/Cmd+K",
      description:
        "Move bb's own quick palette to Mod+Shift+P so Ctrl/Cmd+K opens Ultra Cmd+K. Turning this off restores bb's binding.",
      default: true,
    },
  });

  // --- hotkey ---------------------------------------------------------------

  async function hotkeyStatus(): Promise<HotkeyStatus> {
    const config = await bb.sdk.system.config();
    const override = config.keybindingOverrides.find((entry) => entry.command === HOST_COMMAND);
    const hostHoldsModK = config.keybindings.some(
      (binding) => binding.command === HOST_COMMAND && isModK(binding.shortcut),
    );
    const claimed = (await bb.storage.kv.get<boolean>(CLAIM_KEY)) === true;
    let status: Omit<HotkeyStatus, "description">;
    if (hostHoldsModK) status = { state: "taken", reason: override ? "user-override" : "host-default" };
    else if (claimed) status = { state: "free", reason: "claimed" };
    else if (override) status = { state: "free", reason: "user-override" };
    else status = { state: "free", reason: "not-bound" };
    return { ...status, description: describe(status) };
  }

  async function claimHotkey(): Promise<HotkeyStatus> {
    const status = await hotkeyStatus();
    if (status.state === "free") return status;
    const config = await bb.sdk.system.config();
    const displaced = config.keybindingOverrides.find((entry) => entry.command === HOST_COMMAND);
    if (displaced) {
      const record: Override = { command: HOST_COMMAND, shortcut: displaced.shortcut };
      await bb.storage.kv.set(DISPLACED_KEY, record);
    }
    await bb.sdk.system.updateKeyboardSettings([
      ...config.keybindingOverrides.filter((entry) => entry.command !== HOST_COMMAND),
      { command: HOST_COMMAND, shortcut: { ...RELOCATED_SHORTCUT } },
    ]);
    await bb.storage.kv.set(CLAIM_KEY, true);
    bb.log.info(`moved ${HOST_COMMAND} to Mod+Shift+P; Ctrl/Cmd+K now opens Ultra Cmd+K`);
    return hotkeyStatus();
  }

  async function releaseHotkey(): Promise<HotkeyStatus> {
    const claimed = (await bb.storage.kv.get<boolean>(CLAIM_KEY)) === true;
    if (claimed) {
      const config = await bb.sdk.system.config();
      const displaced = await bb.storage.kv.get<Override>(DISPLACED_KEY);
      await bb.sdk.system.updateKeyboardSettings([
        ...config.keybindingOverrides.filter((entry) => entry.command !== HOST_COMMAND),
        ...(displaced ? [displaced] : []),
      ]);
      await bb.storage.kv.delete(CLAIM_KEY);
      await bb.storage.kv.delete(DISPLACED_KEY);
      bb.log.info(`restored ${HOST_COMMAND} binding`);
    }
    return hotkeyStatus();
  }

  // --- theme ----------------------------------------------------------------

  /** Anchors from the theme's own stylesheet; null when it declares none we can use. */
  async function themeSwatch(themeId: string) {
    try {
      const resolved = await bb.sdk.theme.resolve({ themeId });
      return parseThemeSwatch(resolved.customCss);
    } catch (error) {
      bb.log.debug(`swatch for ${themeId} unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async function themeState() {
    const catalog = await bb.sdk.theme.catalog();
    const contributed = [
      // Custom themes are folders under ~/.bb/theme; the folder name is the
      // theme id and the only name bb has for it, so show it verbatim.
      ...catalog.custom.map((id) => ({ id, name: id, description: `~/.bb/theme/${id}`, kind: "custom" as const })),
      ...catalog.plugins.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        kind: "plugin" as const,
      })),
    ];
    const swatches = await Promise.all(contributed.map((entry) => themeSwatch(entry.id)));
    const entries: ThemeEntry[] = [
      ...BUILTIN_THEMES,
      ...contributed.map((entry, index) => ({ ...entry, swatch: swatches[index] ?? null })),
    ];
    return { activeId: catalog.active.themeId, faviconColor: catalog.active.faviconColor, entries };
  }

  async function selectTheme(themeId: string, faviconColor?: FaviconColor) {
    const current = await bb.sdk.theme.get();
    const result = await bb.sdk.theme.set({ themeId, faviconColor: faviconColor ?? current.faviconColor });
    return { themeId: result.themeId, faviconColor: result.faviconColor };
  }

  // --- bb execution ---------------------------------------------------------

  const host = bb.hosts.experimental_client({ contract: hostContract });

  async function resolveHostId(requested?: string): Promise<string> {
    if (requested) return requested;
    const config = await bb.sdk.system.config();
    if (config.primaryHostId) return config.primaryHostId;
    const hosts = await bb.sdk.hosts.list();
    const connected = hosts.find((entry) => entry.status === "connected");
    if (!connected) throw new Error("No connected host to run bb on.");
    return connected.id;
  }

  async function runBb(args: string[], hostId?: string) {
    return host.call("run_bb", { args }, { hostId: await resolveHostId(hostId), timeoutMs: 45_000 });
  }

  // --- bootstrap ------------------------------------------------------------

  async function bootstrap(): Promise<Bootstrap> {
    const [config, hotkey, theme, plugins, hosts] = await Promise.all([
      bb.sdk.system.config(),
      hotkeyStatus(),
      themeState(),
      bb.sdk.plugins.list(),
      bb.sdk.hosts.list().catch(() => []),
    ]);
    const launcher = plugins.plugins.find((entry) => entry.id === "quick-thread");
    return {
      hotkey,
      keybindings: config.keybindings.map((binding) => ({
        command: binding.command,
        desktopOnly: binding.desktopOnly,
        shortcut: binding.shortcut,
        when: { all: [...binding.when.all], none: [...binding.when.none] },
      })),
      theme,
      launcherInstalled: launcher !== undefined && launcher.enabled && launcher.status === "running",
      plugins: plugins.plugins
        .filter((entry) => entry.id !== bb.pluginId)
        .map((entry) => ({ id: entry.id, name: entry.name ?? entry.id, enabled: entry.enabled, status: entry.status })),
      hosts: hosts.map((entry) => ({ id: entry.id, name: entry.name, status: entry.status })),
      primaryHostId: config.primaryHostId,
    };
  }

  // --- realtime -------------------------------------------------------------
  // Everything in the bootstrap has a bb change event. Rather than have each
  // window refetch on a timer, forward those events as one coalesced signal
  // and let the app refetch exactly when something changed.

  let signalTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingReasons = new Set<string>();

  function signalBootstrapChanged(reason: string): void {
    pendingReasons.add(reason);
    if (signalTimer !== null) return;
    signalTimer = setTimeout(() => {
      signalTimer = null;
      const signal: BootstrapSignal = { reasons: [...pendingReasons], at: Date.now() };
      pendingReasons.clear();
      bb.realtime.publish(BOOTSTRAP_CHANNEL, signal);
      bb.log.debug(`bootstrap signal: ${signal.reasons.join(", ")}`);
    }, SIGNAL_COALESCE_MS);
  }

  const unsubscribe = [
    bb.sdk.subscribe({
      event: "system:changed",
      callback: (event) => {
        for (const change of event.changes) if (BOOTSTRAP_TRIGGERS.has(change)) signalBootstrapChanged(change);
      },
    }),
    bb.sdk.subscribe({ event: "system:config-changed", callback: () => signalBootstrapChanged("config-changed") }),
    bb.sdk.subscribe({ event: "host:changed", callback: () => signalBootstrapChanged("hosts-changed") }),
  ];

  bb.rpc.register(rpcContract, {
    get_bootstrap: () => bootstrap(),
    set_theme: ({ themeId }) => selectTheme(themeId),
    set_favicon: async ({ faviconColor }) => {
      const current = await bb.sdk.theme.get();
      return selectTheme(current.themeId, faviconColor);
    },
    list_skills: async ({ projectId, environmentId }) => {
      const result = await bb.sdk.skills.list({ projectId, environmentId });
      return {
        skills: result.skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          scope: skill.scope,
        })),
      };
    },
    thread_action: async ({ threadId, action }) => {
      switch (action) {
        case "stop":
          await bb.sdk.threads.stop({ threadId });
          return { ok: true };
        case "fork": {
          const forked = await bb.sdk.threads.fork({ sourceThreadId: threadId });
          return { ok: true, threadId: forked.id };
        }
        case "compact":
          await bb.sdk.threads.compact({ threadId });
          return { ok: true };
        case "unarchive":
          await bb.sdk.threads.unarchive({ threadId });
          return { ok: true };
      }
    },
    send_message: async ({ threadId, text }) => {
      await bb.sdk.threads.send({ threadId, mode: "auto", input: [{ type: "text", text, mentions: [] }] });
      return { ok: true };
    },
    plugin_action: async ({ pluginId, action }) => {
      if (action === "enable") await bb.sdk.plugins.enable({ pluginId });
      else if (action === "disable") await bb.sdk.plugins.disable({ pluginId });
      else await bb.sdk.plugins.reload({ pluginId });
      return { ok: true };
    },
    run_bb: ({ args, hostId }) => runBb(args, hostId),
    hotkey: ({ action }) =>
      action === "claim" ? claimHotkey() : action === "release" ? releaseHotkey() : hotkeyStatus(),
  });

  // --- CLI ------------------------------------------------------------------

  const usage = [
    "Usage:",
    "  bb ultra-cmd-k status            Show who owns Ctrl/Cmd+K",
    "  bb ultra-cmd-k claim             Move bb's quick palette to Mod+Shift+P",
    "  bb ultra-cmd-k release           Restore bb's quick palette binding",
    "  bb ultra-cmd-k themes [--json]   List selectable themes",
    "  bb ultra-cmd-k theme <id>        Activate a theme",
    "  bb ultra-cmd-k run <bb args…>    Run a bb command on the primary host",
  ].join("\n");
  bb.cli.register({
    name: "ultra-cmd-k",
    summary: "Ultra Cmd+K: hotkey ownership, themes, and bb command execution",
    commands: [
      { name: "status", summary: "Show who owns Ctrl/Cmd+K", usage: "bb ultra-cmd-k status" },
      { name: "claim", summary: "Take over Ctrl/Cmd+K", usage: "bb ultra-cmd-k claim" },
      { name: "release", summary: "Give Ctrl/Cmd+K back to bb", usage: "bb ultra-cmd-k release" },
      { name: "themes", summary: "List selectable themes", usage: "bb ultra-cmd-k themes [--json]" },
      { name: "theme", summary: "Activate a theme", usage: "bb ultra-cmd-k theme <id>" },
      { name: "run", summary: "Run a bb command on the primary host", usage: "bb ultra-cmd-k run <args…>" },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command, ...args] = argv.filter((arg) => arg !== "--json");
      try {
        switch (command) {
          case undefined:
          case "help":
          case "--help":
            return { exitCode: 0, stdout: usage };
          case "status":
          case "claim":
          case "release": {
            const status =
              command === "claim" ? await claimHotkey() : command === "release" ? await releaseHotkey() : await hotkeyStatus();
            return { exitCode: 0, stdout: json ? JSON.stringify(status) : status.description };
          }
          case "themes": {
            const state = await themeState();
            return {
              exitCode: 0,
              stdout: json
                ? JSON.stringify(state)
                : state.entries
                    .map((entry) => `${entry.id === state.activeId ? "*" : " "} ${entry.id.padEnd(32)} ${entry.name} (${entry.kind})`)
                    .join("\n"),
            };
          }
          case "theme": {
            const themeId = args[0];
            if (!themeId) break;
            const result = await selectTheme(themeId);
            return { exitCode: 0, stdout: json ? JSON.stringify(result) : `Active theme: ${result.themeId}` };
          }
          case "run": {
            if (args.length === 0) break;
            const result = await runBb(args);
            return {
              exitCode: result.code ?? 1,
              stdout: json ? JSON.stringify(result) : result.stdout,
              ...(json || !result.stderr ? {} : { stderr: result.stderr }),
            };
          }
        }
        return { exitCode: 1, stderr: usage };
      } catch (error) {
        return { exitCode: 1, stderr: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  // --- lifecycle ------------------------------------------------------------

  const syncHotkey = async (takeOver: boolean) => {
    try {
      const status = takeOver ? await claimHotkey() : await releaseHotkey();
      bb.log.info(`hotkey: ${status.description}`);
    } catch (error) {
      bb.log.warn(`hotkey sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  settings.onChange((next, prev) => {
    if (next.takeOverCmdK !== prev.takeOverCmdK) void syncHotkey(next.takeOverCmdK);
  });
  void settings.get().then((values) => syncHotkey(values.takeOverCmdK));

  bb.onDispose(() => {
    for (const stop of unsubscribe) stop();
    if (signalTimer !== null) clearTimeout(signalTimer);
    bb.log.info("disposed");
  });
}
