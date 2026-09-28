// Keeps the bootstrap store current from the always-mounted overlay:
// installs the RPC fetcher, refreshes once per burst of server signals, and
// reconciles after the realtime socket reconnects (signals sent meanwhile
// were never delivered). Nothing is fetched until the palette first opens.
import { useCallback, useEffect, useRef } from "react";
import { useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import { bootstrapStore } from "@/lib/bootstrap-store";
import { BOOTSTRAP_CHANNEL, isBootstrapSignal, type rpcContract } from "@/lib/contract";

const SIGNAL_DEBOUNCE_MS = 100;

export function useBootstrapSync(): void {
  const rpc = useRpc<typeof rpcContract>();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    bootstrapStore.setFetcher(() => rpc.call("get_bootstrap", {}));
    return () => bootstrapStore.setFetcher(null);
  }, [rpc]);

  const scheduleRefresh = useCallback(() => {
    // Nothing loaded yet means nothing to keep fresh; the first open fetches.
    if (bootstrapStore.get().bootstrap === null) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void bootstrapStore.refresh().catch(() => undefined);
    }, SIGNAL_DEBOUNCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useRealtime(
    BOOTSTRAP_CHANNEL,
    useCallback(
      (payload: unknown) => {
        if (isBootstrapSignal(payload)) scheduleRefresh();
      },
      [scheduleRefresh],
    ),
  );

  const connection = useRealtimeConnectionState();
  const previous = useRef(connection);
  useEffect(() => {
    if (connection === "connected" && previous.current !== "connected") scheduleRefresh();
    previous.current = connection;
  }, [connection, scheduleRefresh]);
}
