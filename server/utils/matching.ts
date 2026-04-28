// Client name normalization + similarity scoring across platforms.
// Used for auto-suggesting NinjaOne / Huntress / CIPP mappings to CW companies.

const SUFFIXES = /\b(inc|llc|pllc|corp|ltd|co|group|services|solutions|tech|technologies|consulting|associates|management|systems|partners|company|international|properties|enterprises|law|legal|psc|pc|dds|cpa|md|dvm)\b/g;

// Common words that match too readily across unrelated names.
// Filtered out from token comparison only — they still appear in normalized
// strings for substring/exact-match purposes.
const STOPWORDS = new Set([
  "and", "the", "for", "with", "from", "but", "all", "our", "your",
]);

export function normalizeName(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, " and ")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns a similarity score from 0 (no match) to 1 (perfect match)
 * after normalizing entity suffixes, punctuation, and "&" / "and".
 *
 *   1.00  exact match after normalization
 *   0.95  one is a full substring of the other (handles "Acme" vs "Acme Holdings")
 *   0–1   token overlap ratio (Jaccard-ish, partial-token aware)
 *
 * Token matching is partial — a CW token matches a platform token if either
 * contains the other (e.g. "clay" matches "claytonville"). This is forgiving
 * for the common case where one platform has a longer/shorter form of a name.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    // Penalize a tiny bit so exact still ranks above substring
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.85 + 0.10 * ratio;
  }

  const tokA = na.split(" ").filter(t => t.length > 2 && !STOPWORDS.has(t));
  const tokB = nb.split(" ").filter(t => t.length > 2 && !STOPWORDS.has(t));
  if (tokA.length === 0 || tokB.length === 0) return 0;

  const shorter = tokA.length <= tokB.length ? tokA : tokB;
  const longer = tokA.length <= tokB.length ? tokB : tokA;
  const hits = shorter.filter(t =>
    longer.some(lt => lt === t || lt.includes(t) || t.includes(lt))
  ).length;
  return hits / shorter.length;
}

// Backward-compat: returns true above the original 0.8 threshold
export function fuzzyNameMatch(cwName: string, platformName: string): boolean {
  return nameSimilarity(cwName, platformName) >= 0.8;
}

export interface MatchCandidate<T> {
  item: T;
  score: number;
}

/**
 * Find the best match for `target` among `candidates`, returning the top
 * candidate with score ≥ minScore (or null). `getName` extracts the
 * comparable name from each candidate.
 */
export function findBestMatch<T>(
  target: string,
  candidates: T[],
  getName: (c: T) => string,
  minScore = 0.6
): MatchCandidate<T> | null {
  let best: MatchCandidate<T> | null = null;
  for (const c of candidates) {
    const score = nameSimilarity(target, getName(c));
    if (score >= minScore && (!best || score > best.score)) {
      best = { item: c, score };
    }
  }
  return best;
}
