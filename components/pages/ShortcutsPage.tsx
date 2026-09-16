// "?" mode: every effective host keybinding on this client. Enter relays it.
import { CommandGroup } from "@/components/ui/command";
import { PaletteRow } from "@/components/PaletteRow";
import { usePaletteApi } from "@/components/PaletteContext";
import { findBinding, formatShortcut, HOST_COMMANDS, isDesktopApp } from "@/lib/host-commands";

function labelFor(commandId: string): string {
  const spec = HOST_COMMANDS.find((entry) => entry.id === commandId);
  if (spec) return spec.title;
  const jump = /^thread\.jump\.(\d)$/.exec(commandId);
  if (jump) return `Open sidebar thread ${jump[1]}`;
  const pane = /^pane\.focus\.(\d)$/.exec(commandId);
  if (pane) return `Focus pane ${pane[1]}`;
  const question = /^question\.select\.(\d)$/.exec(commandId);
  if (question) return `Answer option ${question[1]}`;
  if (commandId.startsWith("browser.")) return `Browser: ${commandId.slice("browser.".length)}`;
  return commandId;
}

export function ShortcutsPage() {
  const api = usePaletteApi();
  const bindings = api.bootstrap?.keybindings ?? [];
  const isDesktop = isDesktopApp();
  const seen = new Set<string>();
  const rows = bindings
    .filter((binding) => binding.shortcut !== null && (!binding.desktopOnly || isDesktop))
    .filter((binding) => {
      // One row per command: the desktop-specific binding wins on desktop.
      const effective = findBinding(bindings, binding.command);
      if (effective !== binding || seen.has(binding.command)) return false;
      seen.add(binding.command);
      return true;
    })
    .map((binding) => ({ binding, label: labelFor(binding.command) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <CommandGroup heading={`Keyboard shortcuts (${isDesktop ? "desktop" : "web"})`}>
      {rows.map(({ binding, label }) => (
        <PaletteRow
          key={binding.command}
          value={`shortcut:${binding.command}`}
          keywords={[label, binding.command]}
          icon="ChevronRight"
          title={label}
          subtitle={binding.command}
          shortcut={formatShortcut(binding.shortcut!, api.isMac)}
          onSelect={async () => {
            api.record(`host:${binding.command}`);
            await api.relay(binding.command);
          }}
        />
      ))}
    </CommandGroup>
  );
}
