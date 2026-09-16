// Everything a row or page needs to act, in one context so pages stay small.
import { createContext, useContext, useEffect } from "react";
import type {
  BbContext,
  BbNavigate,
  PluginRpcClient,
  PluginSidebarThreadActions,
  PluginSidebarThreadsState,
} from "@get-bb/plugin-sdk/app";
import type { Bootstrap, rpcContract } from "@/lib/contract";
import type { Action, Page } from "@/lib/palette-types";

export type PaletteApi = {
  rpc: PluginRpcClient<typeof rpcContract>;
  nav: BbNavigate;
  threadActions: PluginSidebarThreadActions;
  threads: PluginSidebarThreadsState;
  bbContext: BbContext;
  bootstrap: Bootstrap | null;
  refreshBootstrap: () => Promise<Bootstrap | null>;
  isMac: boolean;
  close: () => void;
  push: (page: Page) => void;
  pop: () => void;
  replace: (page: Page) => void;
  /** Record a completed action for the Recent group. */
  record: (id: string) => void;
  /** Close, wait for the overlay to go inert, then relay a host shortcut. */
  relay: (commandId: string) => Promise<boolean>;
  reportError: (error: unknown) => void;
  /** Make rows answer Ctrl/Cmd+Enter and → by id; returns an unregister. */
  registerActions: (actions: readonly Action[]) => () => void;
  /** Replace the input text (e.g. jump into "$ " mode). */
  setQuery: (value: string) => void;
};

const PaletteApiContext = createContext<PaletteApi | null>(null);

export const PaletteApiProvider = PaletteApiContext.Provider;

export function usePaletteApi(): PaletteApi {
  const api = useContext(PaletteApiContext);
  if (api === null) throw new Error("usePaletteApi must be used inside the palette");
  return api;
}

export function useRegisterActions(actions: readonly Action[]): void {
  const api = usePaletteApi();
  useEffect(() => api.registerActions(actions), [api, actions]);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
