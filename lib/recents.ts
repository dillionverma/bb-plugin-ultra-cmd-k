// Recents ranking: every executed action bumps a { count, lastUsedAt } entry.
// Score = frequency × recency decay (half-life ~3 days), so a command you use
// daily stays near the top while a one-off fades within a week.

export const RECENTS_KEY = "bb.ultra-cmd-k.recents";
export const RECENTS_LIMIT = 40;
const HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

export type RecentEntry = { id: string; count: number; lastUsedAt: number };
export type RecentsMap = Record<string, RecentEntry>;

export function score(entry: RecentEntry, now: number): number {
  const age = Math.max(0, now - entry.lastUsedAt);
  return entry.count * Math.pow(0.5, age / HALF_LIFE_MS);
}

export function rank(map: RecentsMap, now: number, limit: number): string[] {
  return Object.values(map)
    .sort((a, b) => score(b, now) - score(a, now) || b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit)
    .map((entry) => entry.id);
}

export function bump(map: RecentsMap, id: string, now: number): RecentsMap {
  const previous = map[id];
  const next: RecentsMap = {
    ...map,
    [id]: { id, count: (previous?.count ?? 0) + 1, lastUsedAt: now },
  };
  const ids = rank(next, now, RECENTS_LIMIT);
  const trimmed: RecentsMap = {};
  for (const key of ids) trimmed[key] = next[key]!;
  return trimmed;
}

export function loadRecents(storage: Pick<Storage, "getItem"> = localStorage): RecentsMap {
  try {
    const raw = storage.getItem(RECENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const map: RecentsMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as RecentEntry).count === "number" &&
        typeof (value as RecentEntry).lastUsedAt === "number"
      ) {
        map[id] = { id, count: (value as RecentEntry).count, lastUsedAt: (value as RecentEntry).lastUsedAt };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function saveRecents(map: RecentsMap, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(RECENTS_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode: recents are a nicety */
  }
}

// --- tiny external store so every palette instance shares one map ---------

let current: RecentsMap | null = null;
const listeners = new Set<() => void>();

function state(): RecentsMap {
  if (current === null) current = typeof localStorage === "undefined" ? {} : loadRecents();
  return current;
}

export const recentsStore = {
  get: state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  record(id: string, now = Date.now()): void {
    current = bump(state(), id, now);
    saveRecents(current);
    listeners.forEach((listener) => listener());
  },
  clear(): void {
    current = {};
    saveRecents(current);
    listeners.forEach((listener) => listener());
  },
};
