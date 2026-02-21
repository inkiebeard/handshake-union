const STORAGE_KEY = 'hu_reaction_history';
const MAX_QUICK_REACTIONS = 10;

type ReactionCounts = Record<string, number>;

function readCounts(): ReactionCounts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ReactionCounts;
  } catch {
    return {};
  }
}

function writeCounts(counts: ReactionCounts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // localStorage may be unavailable (private browsing quotas, etc.)
  }
}

/**
 * Record that the user selected a given emoji code.
 * Increments the usage count stored in localStorage.
 */
export function recordReactionUsage(code: string): void {
  const counts = readCounts();
  counts[code] = (counts[code] ?? 0) + 1;
  writeCounts(counts);
}

/**
 * Returns the user's top N most-used emoji codes, ordered by descending usage.
 * If fewer than `count` codes exist in history, falls back to the provided
 * `defaults` to fill the remaining slots (avoiding duplicates).
 */
export function getTopReactions(
  defaults: string[],
  count: number = MAX_QUICK_REACTIONS
): string[] {
  const counts = readCounts();

  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([code]) => code);

  const result: string[] = [...sorted.slice(0, count)];

  if (result.length < count) {
    for (const code of defaults) {
      if (result.length >= count) break;
      if (!result.includes(code)) {
        result.push(code);
      }
    }
  }

  return result;
}
