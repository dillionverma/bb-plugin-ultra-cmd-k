// One bootstrap per window (keybindings, theme catalog, plugins, hosts), kept
// fresh by the server's realtime signal instead of a refetch timer.
//
// The overlay, which is always mounted, installs the fetcher and forwards
// signals (see components/BootstrapSync.tsx); the palette reads through
// useBootstrap() and renders instantly on every open after the first. A long
// fallback re-validates on open in case a signal was missed while the socket
// was down. Module state, not context, because the overlay and the palette
// mount in separate trees.
import { useSyncExternalStore } from "react";
import type { Bootstrap } from "./contract";

/** Re-validate on open after this long without a refresh; realtime normally beats it. */
export const BOOTSTRAP_STALE_MS = 5 * 60_000;

type BootstrapFetcher = () => Promise<Bootstrap>;
type State = { bootstrap: Bootstrap | null; loadedAt: number };

let state: State = { bootstrap: null, loadedAt: 0 };
let installed: BootstrapFetcher | null = null;
let inFlight: Promise<Bootstrap> | null = null;
let queued = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export const bootstrapStore = {
  get(): State {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The long-lived fetcher (the overlay's RPC client). Callers may pass their own to `refresh`. */
  setFetcher(fetcher: BootstrapFetcher | null): void {
    installed = fetcher;
  },
  /**
   * Fetch now. Concurrent callers share the request in flight; a request
   * asked for while one is running (a signal mid-fetch) runs once more after
   * it, so the last write always reflects the latest server state.
   */
  refresh(fetcher: BootstrapFetcher | null = installed): Promise<Bootstrap> {
    if (inFlight !== null) {
      queued = true;
      return inFlight;
    }
    if (fetcher === null) return Promise.reject(new Error("Ultra Cmd+K: no bootstrap fetcher installed"));
    const request = fetcher().then((bootstrap) => {
      state = { bootstrap, loadedAt: Date.now() };
      emit();
      return bootstrap;
    });
    inFlight = request;
    void request
      .catch(() => undefined)
      .then(() => {
        inFlight = null;
        if (queued) {
          queued = false;
          void bootstrapStore.refresh(fetcher).catch(() => undefined);
        }
      });
    return request;
  },
  /** Refresh only when nothing is loaded yet or the fallback window has elapsed. */
  ensureFresh(fetcher: BootstrapFetcher | null = installed, now = Date.now()): Promise<Bootstrap> {
    if (state.bootstrap !== null && now - state.loadedAt <= BOOTSTRAP_STALE_MS) return Promise.resolve(state.bootstrap);
    return bootstrapStore.refresh(fetcher);
  },
  /** Test hook. */
  reset(): void {
    state = { bootstrap: null, loadedAt: 0 };
    installed = null;
    inFlight = null;
    queued = false;
    emit();
  },
};

const getBootstrap = () => state.bootstrap;

export function useBootstrap(): Bootstrap | null {
  return useSyncExternalStore(bootstrapStore.subscribe, getBootstrap, getBootstrap);
}
