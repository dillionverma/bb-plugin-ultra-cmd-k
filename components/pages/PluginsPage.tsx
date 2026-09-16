import { toast } from "sonner";
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";

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
        icon="Puzzle"
        title={plugin.name}
        subtitle={plugin.status === "running" ? plugin.id : `${plugin.id} · ${plugin.status}`}
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
    <CommandGroup heading={`${plugin.name} · ${plugin.status}`}>
      {plugin.enabled ? (
        <>
          <PaletteRow value="plugin:reload" keywords={["reload", "restart"]} icon="RotateCcw" title="Reload" onSelect={act("reload", "reloaded")} />
          <PaletteRow value="plugin:disable" keywords={["disable", "off"]} icon="Pause" title="Disable" onSelect={act("disable", "disabled")} />
        </>
      ) : (
        <PaletteRow value="plugin:enable" keywords={["enable", "on"]} icon="Play" title="Enable" onSelect={act("enable", "enabled")} />
      )}
      <PaletteRow
        value="plugin:logs"
        keywords={["logs"]}
        icon="FileText"
        title="Show recent logs"
        subtitle={`bb plugin logs ${plugin.id}`}
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
