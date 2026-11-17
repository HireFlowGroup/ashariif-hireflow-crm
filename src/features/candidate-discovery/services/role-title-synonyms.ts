/**
 * Beperkte synoniemen voor zoekqueries — geen generieke skill-hallucinaties.
 * Alleen termen die in vacaturetitel/requirements voorkomen worden uitgebreid.
 */
const TITLE_SYNONYM_GROUPS: string[][] = [
  ["engineer", "developer", "ontwikkelaar", "programmeur"],
  ["frontend", "front-end", "front end"],
  ["backend", "back-end", "back end"],
  ["fullstack", "full-stack", "full stack"],
  ["recruiter", "recruitment consultant", "talent advisor", "wervingsadviseur"],
  ["account manager", "accountmanager", "key account"],
  ["project manager", "projectmanager", "projectleider"],
  ["data analyst", "data-analist", "analist"],
  ["sales", "account executive", "commercieel"],
  ["hr", "human resources", "people", "hrm"],
  ["devops", "sre", "platform engineer"],
  ["product owner", "product manager", "po"],
];

export function expandTitleTermsForSearch(title: string): string[] {
  const lower = title.toLowerCase();
  const terms = new Set<string>();

  for (const word of title.split(/\s+/).filter((w) => w.length > 2)) {
    terms.add(word.replace(/[^\p{L}\p{N}+#. -]/gu, ""));
  }

  for (const group of TITLE_SYNONYM_GROUPS) {
    if (group.some((term) => lower.includes(term))) {
      for (const term of group) {
        if (term.length >= 3) terms.add(term);
      }
    }
  }

  return [...terms].filter(Boolean).slice(0, 8);
}

export function roleSynonymsMatchingText(text: string, vacancyTitle: string): string[] {
  const lower = text.toLowerCase();
  const titleLower = vacancyTitle.toLowerCase();
  const hits: string[] = [];

  for (const group of TITLE_SYNONYM_GROUPS) {
    const titleHit = group.some((term) => titleLower.includes(term));
    if (!titleHit) continue;
    const snippetHit = group.find((term) => term.length >= 4 && lower.includes(term));
    if (snippetHit) hits.push(`synoniem rol: ${snippetHit}`);
  }

  return hits;
}