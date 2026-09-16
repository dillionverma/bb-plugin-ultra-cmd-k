// Matching. cmdk's default scorer accepts any subsequence — "theme" scores
// 0.8 against "Toggle model picker Open the…" — while giving a genuine typo
// ("setings") 0.15. So we rank contiguous matches, then fall back to a
// one-edit typo check against each word instead of subsequence scoring.

const TYPO_MIN_LENGTH = 5;

/** Levenshtein distance capped at 2 (early exit keeps it cheap per row). */
export function editDistance(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > cap) return cap + 1;
    previous = current;
  }
  return previous[b.length]!;
}

export function scoreMatch(haystack: string, query: string): number {
  const needle = query.trim().toLowerCase();
  if (needle === "") return 1;
  const text = haystack.toLowerCase();
  if (text.startsWith(needle)) return 1;
  const at = text.indexOf(needle);
  if (at !== -1) {
    // Word-boundary substring beats mid-word substring.
    const boundary = /[\s\-_/:.,()[\]]/.test(text[at - 1]!);
    return boundary ? 0.95 : 0.85;
  }
  // Every query word appears somewhere (any order) → strong match.
  const words = needle.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => text.includes(word))) return 0.8;
  // Typo tolerance: one edit away from the start of some word.
  if (needle.length >= TYPO_MIN_LENGTH && words.length === 1) {
    for (const word of text.split(/[\s\-_/:.,()[\]]+/)) {
      if (word.length < needle.length - 1) continue;
      // Compare against word prefixes one shorter/longer too, so a dropped or
      // doubled letter ("setings" → "settings") still counts as one edit.
      for (const length of [needle.length - 1, needle.length, needle.length + 1]) {
        if (length > word.length) continue;
        if (editDistance(needle, word.slice(0, length), 1) <= 1) return 0.5;
      }
    }
  }
  return 0;
}
