// bb-plugin-ultra-cmd-k — frontend entry.
//
// Ultra Cmd+K is a single app-wide overlay (the palette) plus three ways in:
// the Ctrl/Cmd+K listener the overlay owns, a row in bb's own quick palette
// (Mod+Shift+P once this plugin holds Cmd+K), and a sidebar footer button.
// Everything else lives under components/.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { PaletteOverlay } from "@/components/PaletteOverlay";
import { Settings } from "@/components/Settings";
import { OPEN_EVENT, paletteStore } from "@/lib/palette-store";

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "palette", component: PaletteOverlay });

  // Reachable from bb's palette even if Cmd+K could not be claimed. The row
  // cannot reach React state directly, so it signals the overlay.
  app.slots.commandPaletteAction({
    id: "open",
    title: "Ultra Cmd+K: open palette",
    run: () => {
      window.dispatchEvent(new Event(OPEN_EVENT));
    },
  });
  app.slots.commandPaletteAction({
    id: "themes",
    title: "Ultra Cmd+K: change theme",
    run: () => paletteStore.open("theme"),
  });

  app.experimental_sidebarFooter.register({
    kind: "action",
    id: "open",
    label: "Ultra Cmd+K",
    icon: "Search",
    onActivate: () => paletteStore.toggle(),
  });

  app.slots.settingsSection({
    id: "ultra-cmd-k",
    title: "Ultra Cmd+K",
    description: "Hotkey ownership, prefix modes, and recents.",
    component: Settings,
  });
});
