import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_STALE_MS, bootstrapStore } from "@/lib/bootstrap-store";
import { isBootstrapSignal, type Bootstrap } from "@/lib/contract";

function fakeBootstrap(tag: string): Bootstrap {
  return {
    hotkey: { state: "free", reason: "claimed", description: tag },
    keybindings: [],
    theme: { activeId: "default", faviconColor: "default", entries: [] },
    launcherRunning: false,
    plugins: [],
    hosts: [],
    primaryHostId: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("bootstrapStore", () => {
  beforeEach(() => bootstrapStore.reset());

  it("stores the fetched bootstrap and notifies subscribers", async () => {
    const listener = vi.fn();
    bootstrapStore.subscribe(listener);
    bootstrapStore.setFetcher(async () => fakeBootstrap("one"));
    await bootstrapStore.refresh();
    expect(bootstrapStore.get().bootstrap?.hotkey.description).toBe("one");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("shares one request between concurrent callers and runs once more if asked mid-flight", async () => {
    const first = deferred<Bootstrap>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(fakeBootstrap("two"));
    bootstrapStore.setFetcher(fetcher);

    const a = bootstrapStore.refresh();
    const b = bootstrapStore.refresh(); // arrives while `a` is in flight
    expect(fetcher).toHaveBeenCalledTimes(1);

    first.resolve(fakeBootstrap("one"));
    await Promise.all([a, b]);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(bootstrapStore.get().bootstrap?.hotkey.description).toBe("two"));
  });

  it("ensureFresh skips a recent bootstrap and refetches a stale one", async () => {
    const fetcher = vi.fn(async () => fakeBootstrap("x"));
    bootstrapStore.setFetcher(fetcher);
    await bootstrapStore.ensureFresh();
    await bootstrapStore.ensureFresh();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await bootstrapStore.ensureFresh(undefined, Date.now() + BOOTSTRAP_STALE_MS + 1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects without a fetcher and accepts a caller-supplied one", async () => {
    await expect(bootstrapStore.refresh()).rejects.toThrow(/fetcher/);
    await bootstrapStore.refresh(async () => fakeBootstrap("mine"));
    expect(bootstrapStore.get().bootstrap?.hotkey.description).toBe("mine");
  });

  it("recovers after a failed fetch", async () => {
    bootstrapStore.setFetcher(vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(fakeBootstrap("ok")));
    await expect(bootstrapStore.refresh()).rejects.toThrow("boom");
    await bootstrapStore.refresh();
    expect(bootstrapStore.get().bootstrap?.hotkey.description).toBe("ok");
  });
});

describe("isBootstrapSignal", () => {
  it("accepts the server's shape and nothing else", () => {
    expect(isBootstrapSignal({ reasons: ["config-changed"], at: 1 })).toBe(true);
    expect(isBootstrapSignal({ reasons: "config-changed", at: 1 })).toBe(false);
    expect(isBootstrapSignal(null)).toBe(false);
    expect(isBootstrapSignal("bootstrap")).toBe(false);
  });
});
