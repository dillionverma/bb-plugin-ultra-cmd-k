// Module-level open/close state shared by the overlay, the hotkey, the
// command-palette bridge row and the sidebar footer button — none of which
// share a React tree. Read with useSyncExternalStore.
import { useSyncExternalStore } from "react";

export const OPEN_EVENT = "ultra-cmd-k:open";

export type PaletteState = {
  open: boolean;
  /** Bumps on every open so the input can refocus and reset. */
  openNonce: number;
  /** Query to seed the input with on open (e.g. ">" for commands mode). */
  initialQuery: string;
};

let state: PaletteState = { open: false, openNonce: 0, initialQuery: "" };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export const paletteStore = {
  get(): PaletteState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  open(initialQuery = ""): void {
    state = { open: true, openNonce: state.openNonce + 1, initialQuery };
    emit();
  },
  close(): void {
    if (!state.open) return;
    state = { ...state, open: false };
    emit();
  },
  toggle(initialQuery = ""): void {
    if (state.open) paletteStore.close();
    else paletteStore.open(initialQuery);
  },
};

export function usePaletteState(): PaletteState {
  return useSyncExternalStore(paletteStore.subscribe, paletteStore.get, paletteStore.get);
}

/** Waits until the overlay has rendered closed + inert (two frames). */
export function afterClose(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
