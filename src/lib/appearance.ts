// Light / dark / system is a client-local preference. bb reads
// localStorage["bb.theme"] (a raw string) through a storage-backed atom that
// listens for the `storage` event, which the originating tab never receives —
// so after writing we dispatch a synthetic one, and toggle the `dark` class as
// a fallback so the switch is visible even if the event is ignored.

const MODE_KEY = "bb.theme";
export const APPEARANCE_MODES = ["light", "dark", "system"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export function readAppearanceMode(storage: Pick<Storage, "getItem"> = localStorage): AppearanceMode {
  try {
    const stored = storage.getItem(MODE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveAppearance(mode: AppearanceMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function writeAppearanceMode(mode: AppearanceMode): void {
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(MODE_KEY);
    localStorage.setItem(MODE_KEY, mode);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: MODE_KEY,
        oldValue: previous,
        newValue: mode,
        storageArea: localStorage,
      }),
    );
  } catch {
    /* private mode — the class toggle below still applies */
  }
  document.documentElement.classList.toggle("dark", resolveAppearance(mode) === "dark");
}
