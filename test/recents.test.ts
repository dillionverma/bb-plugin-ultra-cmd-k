import { describe, expect, it } from "vitest";
import { bump, loadRecents, rank, RECENTS_LIMIT, saveRecents, type RecentsMap } from "@/lib/recents";

const DAY = 24 * 60 * 60 * 1000;

describe("recents ranking", () => {
  it("prefers frequent commands, then recency", () => {
    const now = 100 * DAY;
    let map: RecentsMap = {};
    for (let i = 0; i < 5; i += 1) map = bump(map, "daily", now - i * DAY);
    map = bump(map, "once-just-now", now);
    map = bump(map, "once-last-week", now - 7 * DAY);
    expect(rank(map, now, 3)).toEqual(["daily", "once-just-now", "once-last-week"]);
  });

  it("lets a stale habit fade below something used today", () => {
    const now = 100 * DAY;
    let map: RecentsMap = {};
    for (let i = 0; i < 3; i += 1) map = bump(map, "old-habit", now - 30 * DAY);
    map = bump(map, "today", now);
    expect(rank(map, now, 2)[0]).toBe("today");
  });

  it("caps the stored map", () => {
    let map: RecentsMap = {};
    for (let i = 0; i < RECENTS_LIMIT + 10; i += 1) map = bump(map, `cmd-${i}`, i);
    expect(Object.keys(map)).toHaveLength(RECENTS_LIMIT);
    expect(map["cmd-0"]).toBeUndefined();
  });

  it("round-trips through storage and ignores garbage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    saveRecents(bump({}, "a", 1), storage);
    expect(loadRecents(storage)).toEqual({ a: { id: "a", count: 1, lastUsedAt: 1 } });
    storage.setItem("bb.ultra-cmd-k.recents", '{"a":"nope","b":{"count":"x"}}');
    expect(loadRecents(storage)).toEqual({});
    storage.setItem("bb.ultra-cmd-k.recents", "not json");
    expect(loadRecents(storage)).toEqual({});
  });
});
