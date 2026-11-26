export type TargetedDiscoveryConstraints = {
  mode: "open" | "targeted";
  employerNames: string[];
  employerDomains: string[];
  /** Human-readable outcome when target cannot be verified */
  notFoundMessage: string;
};

const DOMAIN_PATTERN =
  /(?:officieel\s+domein|domein)\s+([a-z0-9][-a-z0-9.]+\.[a-z]{2,})/gi;

const EXACT_ONE_EMPLOYER_PATTERN =
  /(?:exact\s+)?1\s+werkgever:\s*([^(\n,]+?)(?:\s*\(|$|,)/i;

const EXCLUSIVELY_PATTERN =
  /uitsluitend\s+([^(\n,]+?)(?:\s*\(|$|,)/i;

function normalizeDomain(value: string): string {
  return value.toLowerCase().replace(/^www\./, "").trim();
}

function normalizeEmployerName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function extractTargetedEmployerConstraints(sourceQuery: string): TargetedDiscoveryConstraints {
  const employerNames: string[] = [];
  const employerDomains: string[] = [];

  for (const match of sourceQuery.matchAll(DOMAIN_PATTERN)) {
    const domain = normalizeDomain(match[1] ?? "");
    if (domain) employerDomains.push(domain);
  }

  const exactMatch = EXACT_ONE_EMPLOYER_PATTERN.exec(sourceQuery);
  if (exactMatch?.[1]) {
    employerNames.push(normalizeEmployerName(exactMatch[1]));
  } else {
    const exclusiveMatch = EXCLUSIVELY_PATTERN.exec(sourceQuery);
    if (exclusiveMatch?.[1]) {
      employerNames.push(normalizeEmployerName(exclusiveMatch[1]));
    }
  }

  const targeted = employerDomains.length > 0 || employerNames.length > 0;

  return {
    mode: targeted ? "targeted" : "open",
    employerNames,
    employerDomains,
    notFoundMessage: targeted
      ? `Gespecificeerde werkgever niet gevonden (${employerNames.join(", ") || employerDomains.join(", ")}).`
      : "Geen doelwerkgever in opdracht.",
  };
}

export function employerMatchesTargetedConstraints(input: {
  companyName: string | null | undefined;
  domain: string | null | undefined;
  website?: string | null;
  constraints: TargetedDiscoveryConstraints;
}): boolean {
  if (input.constraints.mode !== "targeted") return true;

  const name = (input.companyName ?? "").toLowerCase();
  const domain = normalizeDomain(input.domain ?? "");
  let websiteDomain = "";
  if (input.website) {
    try {
      websiteDomain = normalizeDomain(new URL(input.website.startsWith("http") ? input.website : `https://${input.website}`).hostname);
    } catch {
      websiteDomain = "";
    }
  }

  for (const targetDomain of input.constraints.employerDomains) {
    const normalized = normalizeDomain(targetDomain);
    if (domain === normalized || domain.endsWith(`.${normalized}`)) return true;
    if (websiteDomain === normalized || websiteDomain.endsWith(`.${normalized}`)) return true;
  }

  for (const targetName of input.constraints.employerNames) {
    const normalized = targetName.toLowerCase();
    if (name.includes(normalized) || normalized.includes(name)) return true;
  }

  return false;
}

export function buildTargetedDiscoveryQueryVariants(input: {
  constraints: TargetedDiscoveryConstraints;
  roles: string[];
}): Array<{ query: string; intent: "company" | "vacancy"; label: string }> {
  const roles = input.roles.length ? input.roles : ["Corporate Recruiter"];
  const domain = input.constraints.employerDomains[0] ?? null;
  const name = input.constraints.employerNames[0] ?? null;
  if (!domain && !name) return [];

  const siteClause = domain ? `site:${domain}` : `"${name}"`;
  return roles.slice(0, 3).map((role) => ({
    query: `${siteClause} "${role}" vacature`,
    intent: "vacancy" as const,
    label: `Targeted ${role}`,
  }));
}