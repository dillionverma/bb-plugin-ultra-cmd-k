// Live theme preview for any theme row, on any page.
//
// Highlighting a row whose value is `theme:<id>` applies that theme after a
// short debounce, the way Settings → Appearance previews on hover. Moving the
// highlight to a non-theme row, leaving the page, or closing the palette puts
// the original back — unless a row committed, in which case the committed
// theme becomes the new original.
import { useEffect, useRef } from "react";
import { useCommandState } from "cmdk";
import { usePaletteApi } from "@/components/PaletteContext";

export const THEME_COMMITTED_EVENT = "ultra-cmd-k:theme-committed";
const PREVIEW_DELAY_MS = 120;

export function themeIdFromValue(value: string): string | null {
  const raw = value.startsWith("recent:") ? value.slice("recent:".length) : value;
  if (!raw.startsWith("theme:") || raw === "theme:pick") return null;
  return raw.slice("theme:".length);
}

export function ThemePreview() {
  const api = usePaletteApi();
  const highlighted = useCommandState((state) => state.value);
  const active = api.bootstrap?.theme.activeId ?? null;
  const original = useRef<string | null>(null);
  const applied = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const rpc = api.rpc;

  // The first bootstrap we see fixes the "original"; commits move it.
  if (original.current === null && active !== null) original.current = active;

  useEffect(() => {
    const onCommit = (event: Event) => {
      const themeId = (event as CustomEvent<string>).detail;
      original.current = themeId;
      applied.current = themeId;
    };
    window.addEventListener(THEME_COMMITTED_EVENT, onCommit);
    return () => window.removeEventListener(THEME_COMMITTED_EVENT, onCommit);
  }, []);

  useEffect(() => {
    const target = themeIdFromValue(highlighted) ?? original.current;
    if (target === null) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if ((applied.current ?? original.current) === target) return;
      applied.current = target;
      void rpc.call("set_theme", { themeId: target }).catch(() => {});
    }, PREVIEW_DELAY_MS);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [highlighted, rpc]);

  // Unmount (page change or close): restore unless the preview is the original.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      const restore = original.current;
      if (restore !== null && applied.current !== null && applied.current !== restore) {
        void rpc.call("set_theme", { themeId: restore }).catch(() => {});
      }
    },
    [rpc],
  );

  return null;
}

/** Call from a theme row's onSelect before applying, so unmount does not revert it. */
export function commitTheme(themeId: string): void {
  window.dispatchEvent(new CustomEvent(THEME_COMMITTED_EVENT, { detail: themeId }));
}
