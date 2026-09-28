import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { StatusIcon, type StatusTone } from "@/components/StatusIcon";
import { usePaletteApi } from "@/components/PaletteContext";
import type { PluginEntry } from "@/lib/contract";
import { GLYPHS } from "@/lib/glyphs";

function pluginTone(plugin: PluginEntry): StatusTone {
  if (!plugin.enabled) return "idle";
  if (plugin.status === "running") return "done";
  if (plugin.status === "starting") return "working";
  if (plugin.status === "needs-configuration") return "needs-you";
  return "problem";
}

export function PluginsPage() {
  const api = usePaletteApi();
  const plugins = [...(api.bootstrap?.plugins ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const enabled = plugins.filter((plugin) => plugin.enabled);
  const disabled = plugins.filter((plugin) => !plugin.enabled);
  const rows = (list: typeof plugins) =>
    list.map((plugin) => (
      <PaletteRow
        key={plugin.id}
        value={`plugin:${plugin.id}`}
        keywords={[plugin.name, plugin.id, plugin.status]}
        iconNode={<StatusIcon tone={pluginTone(plugin)} label={plugin.status} />}
        title={plugin.name}
        meta={plugin.status === "running" || !plugin.enabled ? plugin.id : `${plugin.id} · ${plugin.status}`}
        hasPage
        onSelect={() => api.push({ kind: "plugin", pluginId: plugin.id })}
      />
    ));
  return (
    <>
      {enabled.length > 0 ? <CommandGroup heading="Enabled">{rows(enabled)}</CommandGroup> : null}
      {disabled.length > 0 ? <CommandGroup heading="Disabled">{rows(disabled)}</CommandGroup> : null}
    </>
  );
}

export function PluginPage({ pluginId }: { pluginId: string }) {
  const api = usePaletteApi();
  const plugin = api.bootstrap?.plugins.find((entry) => entry.id === pluginId);
  if (!plugin) return null;
  const act = (action: "enable" | "disable" | "reload", done: string) => async () => {
    try {
      await api.rpc.call("plugin_action", { pluginId, action });
      api.record(`plugin:${action}`);
      await api.refreshBootstrap();
      toast.success(`${plugin.name}: ${done}`);
      api.pop();
    } catch (error) {
      api.reportError(error);
    }
  };
  return (
    <CommandGroup
      heading={
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon tone={pluginTone(plugin)} />
          {plugin.name}
          <span className="font-normal text-muted-foreground/70">{plugin.status}</span>
        </span>
      }
    >
      {plugin.enabled ? (
        <>
          <PaletteRow value="plugin:reload" keywords={["reload", "restart"]} glyph={GLYPHS.reopen} title="Reload" onSelect={act("reload", "reloaded")} />
          <PaletteRow value="plugin:disable" keywords={["disable", "off"]} glyph={GLYPHS.pause} title="Disable" onSelect={act("disable", "disabled")} />
        </>
      ) : (
        <PaletteRow value="plugin:enable" keywords={["enable", "on"]} glyph={GLYPHS.play} title="Enable" onSelect={act("enable", "enabled")} />
      )}
      <PaletteRow
        value="plugin:logs"
        keywords={["logs"]}
        glyph={GLYPHS.logs}
        title="Recent logs"
        meta={`bb plugin logs ${plugin.id}`}
        onSelect={async () => {
          try {
            const result = await api.rpc.call("run_bb", { args: ["plugin", "logs", plugin.id, "-n", "80"] });
            api.push({ kind: "output", title: `bb plugin logs ${plugin.id}`, result });
          } catch (error) {
            api.reportError(error);
          }
        }}
      />
    </CommandGroup>
  );
}
