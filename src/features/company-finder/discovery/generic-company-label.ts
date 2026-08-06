const DUTCH_CITIES = [
  "rotterdam",
  "amsterdam",
  "den haag",
  "utrecht",
  "eindhoven",
  "groningen",
  "tilburg",
  "nederland",
  "netherlands",
];

const GENERIC_ROLE_TERMS = [
  "software ontwikkelaar",
  "software developer",
  "customer success manager",
  "accountmanager",
  "account manager",
  "recruiter",
  "hr manager",
  "developer",
  "ontwikkelaar",
  "engineer",
];

const GENERIC_INDUSTRY_TERMS = [
  "software",
  "it bedrijf",
  "it company",
  "saas",
  "tech bedrijf",
  "softwarebedrijf",
  "software bedrijf",
  "recruitment specialists",
  "recruitment agency",
  "vacatures",
  "bedrijven in",
  "companies in",
  "beste softwarebedrijven",
  "top bedrijven",
  "specialists in",
];

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function looksLikeCityOnly(name: string): boolean {
  const normalized = normalizeLabel(name);
  return DUTCH_CITIES.includes(normalized);
}

function containsGenericIndustryTerm(name: string): boolean {
  const normalized = normalizeLabel(name);
  return GENERIC_INDUSTRY_TERMS.some((term) => normalized.includes(term));
}

function looksLikeRolePlusCity(name: string): boolean {
  const normalized = normalizeLabel(name);
  for (const role of GENERIC_ROLE_TERMS) {
    for (const city of DUTCH_CITIES) {
      if (normalized === `${role} ${city}` || normalized === `${role} in ${city}`) {
        return true;
      }
      if (normalized.startsWith(`${role} `) && normalized.includes(city) && normalized.split(" ").length <= 5) {
        return true;
      }
    }
  }
  return false;
}

/** True when a label is a generic SEO/search title, not a brand name. */
export function isGenericCompanyLabel(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;
  if (looksLikeCityOnly(trimmed)) return true;
  if (looksLikeRolePlusCity(trimmed)) return true;
  if (containsGenericIndustryTerm(trimmed) && !/[A-Z]{2,}/.test(trimmed.replace(trimmed[0], ""))) {
    return true;
  }
  if (/\bin\s+(netherlands|nederland|rotterdam|den haag|amsterdam)\b/i.test(trimmed) && trimmed.split(" ").length <= 6) {
    return true;
  }
  return false;
}

export function genericLabelReason(name: string): string {
  if (looksLikeRolePlusCity(name)) return "Dienst/functie + plaats — geen merknaam";
  if (containsGenericIndustryTerm(name)) return "Generieke branche- of SEO-titel";
  if (looksLikeCityOnly(name)) return "Alleen plaatsnaam";
  return "Generieke bedrijfslabel";
}
