/** Normalizes discovery queries for deduplication within a single run. */
export function normalizeDiscoveryQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeDiscoveryQueryVariants<T extends { query: string }>(variants: T[]): {
  unique: T[];
  duplicatesRemoved: number;
} {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const variant of variants) {
    const key = normalizeDiscoveryQueryKey(variant.query);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(variant);
  }
  return { unique, duplicatesRemoved: variants.length - unique.length };
}