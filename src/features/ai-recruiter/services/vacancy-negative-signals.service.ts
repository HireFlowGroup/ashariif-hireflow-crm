/** URLs and titles that look like vacancies but signal “none available” or generic placeholders. */

export function isNegativeVacancyUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    /geen[-/][\w-]*vacatures?[-/]beschikbaar/i.test(lower)
    || /geen[-\s][\w-]+[-\s]vacatures?[-\s]beschikbaar/i.test(lower)
    || /\bno[- ](open )?(positions|vacancies|jobs)\b/i.test(lower)
    || /\b0[- ]vacancies\b/i.test(lower)
  );
}

export function isPlaceholderOpenVacancyTitle(title: string): boolean {
  const normalized = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^open vacature\b/i.test(normalized) && !/\b(recruiter|recruitment|talent|werving|hr)\b/i.test(normalized)) {
    return true;
  }
  if (/geen\s+\w+(\s+\w+)?\s+vacatures?\s+beschikbaar/i.test(normalized)) return true;
  if (/momenteel geen openstaande vacatures/i.test(normalized)) return true;
  return false;
}