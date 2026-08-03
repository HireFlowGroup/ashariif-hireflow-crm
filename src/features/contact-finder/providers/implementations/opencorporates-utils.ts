import type { Company } from "@/features/companies/domain";
import type { CompanyEnrichment } from "@/features/contact-finder/domain";

type OpenCorporatesCompany = {
  name: string;
  company_number?: string;
  jurisdiction_code?: string;
  registered_address_in_full?: string | null;
  homepage_url?: string | null;
  opencorporates_url?: string;
};

type OpenCorporatesSearchResponse = {
  results?: {
    companies?: Array<{ company: OpenCorporatesCompany }>;
  };
};

type OpenCorporatesOfficer = {
  name?: string;
  position?: string;
  opencorporates_url?: string;
};

type OpenCorporatesOfficersResponse = {
  results?: {
    officers?: Array<{ officer: OpenCorporatesOfficer }>;
  };
};

function buildApiUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(`https://api.opencorporates.com/v0.4/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const apiToken = process.env.OPENCORPORATES_API_TOKEN?.trim();

  if (apiToken) {
    url.searchParams.set("api_token", apiToken);
  }

  return url;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`OpenCorporates gaf status ${response.status} terug.`);
  }

  return (await response.json()) as T;
}

export async function resolveOpenCorporatesCompany(
  company: Company,
): Promise<OpenCorporatesCompany | null> {
  const query = [company.name.trim(), company.city?.trim()].filter(Boolean).join(" ");
  const url = buildApiUrl("companies/search", {
    q: query,
    country_code: "nl",
    per_page: "5",
    order: "score",
  });

  const payload = await fetchJson<OpenCorporatesSearchResponse>(url);
  const rows = payload.results?.companies ?? [];

  if (rows.length === 0) {
    return null;
  }

  const normalizedName = company.name.trim().toLowerCase();

  const exactMatch = rows.find(({ company: row }) =>
    row.name.trim().toLowerCase() === normalizedName,
  );

  return exactMatch?.company ?? rows[0]?.company ?? null;
}

export async function enrichCompanyFromOpenCorporates(
  company: Company,
): Promise<CompanyEnrichment> {
  const match = await resolveOpenCorporatesCompany(company);

  if (!match) {
    return {
      website: company.website,
      linkedInCompanyUrl: buildLinkedInCompanySearchUrl(company.name),
    };
  }

  return {
    website: company.website ?? match.homepage_url ?? null,
    linkedInCompanyUrl: buildLinkedInCompanySearchUrl(company.name),
  };
}

export function buildLinkedInCompanySearchUrl(companyName: string): string {
  const url = new URL("https://www.linkedin.com/search/results/companies/");
  url.searchParams.set("keywords", companyName.trim());
  url.searchParams.set("origin", "GLOBAL_SEARCH_HEADER");
  return url.toString();
}

export async function fetchOpenCorporatesOfficers(
  company: OpenCorporatesCompany,
): Promise<OpenCorporatesOfficer[]> {
  const jurisdiction = company.jurisdiction_code ?? "nl";
  const companyNumber = company.company_number;

  if (!companyNumber) {
    return [];
  }

  const url = buildApiUrl(`companies/${jurisdiction}/${companyNumber}/officers`, {
    per_page: "30",
  });

  const payload = await fetchJson<OpenCorporatesOfficersResponse>(url);

  return (payload.results?.officers ?? [])
    .map(({ officer }) => officer)
    .filter((officer): officer is OpenCorporatesOfficer => Boolean(officer?.name?.trim()));
}

export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();

  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    const firstName = rest.join(" ").trim();

    return {
      firstName: firstName || "—",
      lastName: last.trim() || "—",
    };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "—" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function matchesTargetRole(position: string | undefined, targetRoles: string[]): boolean {
  if (!position?.trim()) {
    return false;
  }

  const normalizedPosition = position.trim().toLowerCase();

  const rolePatterns = [
    ...targetRoles.map((role) => role.toLowerCase()),
    "director",
    "directeur",
    "bestuurder",
    "eigenaar",
    "owner",
    "managing director",
    "ceo",
    "hr",
    "recruit",
    "talent",
    "human resources",
  ];

  return rolePatterns.some((pattern) => normalizedPosition.includes(pattern));
}

export function calculateContactConfidence(input: {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  jobTitle: string | null;
  fromRegistry: boolean;
}): number {
  let score = 0.45;

  if (input.jobTitle) {
    score += 0.15;
  }

  if (input.email) {
    score += 0.25;
  }

  if (input.phone) {
    score += 0.1;
  }

  if (input.linkedinUrl) {
    score += 0.1;
  }

  if (input.fromRegistry) {
    score += 0.1;
  }

  return Math.min(1, Math.round(score * 1000) / 1000);
}
