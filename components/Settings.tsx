// Settings → Ultra Cmd+K: who owns the hotkey, claim/release, and recents.
import { useCallback, useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Kbd } from "@/components/Kbd";
import type { HotkeyStatus, rpcContract } from "@/lib/contract";
import { isMacPlatform } from "@/lib/hotkey";
import { paletteStore } from "@/lib/palette-store";
import { recentsStore } from "@/lib/recents";

export function Settings() {
  const rpc = useRpc<typeof rpcContract>();
  const [status, setStatus] = useState<HotkeyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const isMac = isMacPlatform();

  const run = useCallback(
    async (action: "status" | "claim" | "release") => {
      setBusy(true);
      try {
        setStatus(await rpc.call("hotkey", { action }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [rpc],
  );
  useEffect(() => {
    void run("status");
  }, [run]);

  const free = status?.state === "free";
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Icon
          name={free ? "CircleCheck" : "AlertTriangle"}
          className={free ? "mt-0.5 size-4 text-foreground" : "mt-0.5 size-4 text-destructive"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium">
            <Kbd keys={[isMac ? "⌘" : "Ctrl", "K"]} className="ml-0" />
            <span>{free ? "opens Ultra Cmd+K" : "is still bb's quick palette"}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{status?.description ?? "Checking…"}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {free ? (
            <Button variant="outline" size="sm" disabled={busy || status?.reason !== "claimed"} onClick={() => run("release")}>
              Release
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => run("claim")}>
              Take over
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">
        bb's own quick palette moves to <Kbd keys={[isMac ? "⌘" : "Ctrl", isMac ? "⇧" : "Shift", "P"]} className="ml-0 inline-flex" /> while
        Ultra Cmd+K holds the key. The “Take over” setting above this section does the same thing automatically.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => paletteStore.open()}>
          <Icon name="Search" className="size-4" />
          Open palette
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            recentsStore.clear();
            toast.success("Recent commands cleared");
          }}
        >
          Clear recents
        </Button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono">&gt;</span><span>commands only</span>
        <span className="font-mono">@</span><span>threads only</span>
        <span className="font-mono">#</span><span>projects</span>
        <span className="font-mono">/</span><span>skills</span>
        <span className="font-mono">$</span><span>run a bb command on the primary host</span>
        <span className="font-mono">?</span><span>keyboard shortcuts</span>
      </div>
    </div>
  );
}
