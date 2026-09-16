// Pure keyboard predicates. Kept free of DOM globals so they unit-test in
// isolation and so the overlay's listener stays a one-liner.

export type KeyLike = Pick<
  KeyboardEvent,
  "code" | "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing"
>;

export function isMacPlatform(nav: Pick<Navigator, "userAgent"> = navigator): boolean {
  return /mac|iphone|ipad/i.test(nav.userAgent);
}

/** Cmd on macOS, Ctrl elsewhere — and not both. */
export function hasMod(event: KeyLike, isMac: boolean): boolean {
  return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/** Ctrl/Cmd+K without other modifiers; ignores auto-repeat and IME composition. */
export function isPaletteHotkey(event: KeyLike, isMac: boolean): boolean {
  return (
    hasMod(event, isMac) &&
    !event.shiftKey &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    (event.code === "KeyK" || event.key === "k" || event.key === "K")
  );
}

/** Ctrl/Cmd+Enter: the "secondary" action on a row (open in split, run in background). */
export function isModEnter(event: KeyLike, isMac: boolean): boolean {
  return hasMod(event, isMac) && event.key === "Enter";
}
