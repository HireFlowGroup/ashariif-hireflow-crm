import type { Company } from "@/features/companies/domain";
import { executeTavilySearch } from "@/features/lead-intelligence/providers/manager/search-providers";
import { extractEmailsFromText } from "@/features/lead-intelligence/services/recruitment-normalize";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

function companyDomain(company: Company): string | null {
  if (company.domain) return company.domain.toLowerCase().replace(/^www\./, "");
  if (!company.website) return null;
  try {
    const url = company.website.startsWith("http") ? company.website : `https://${company.website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function buildQueries(company: Company, domain: string | null): string[] {
  const name = company.name;
  const queries = [
    domain ? `site:${domain} recruiter OR "HR Manager" OR recruitment` : null,
    domain ? `site:${domain} "Talent Acquisition" OR werkenbij OR vacatures contact` : null,
    `"${name}" "HR Manager" recruitment email`,
    `"${name}" recruiter contact email`,
    `"${name}" vacatures contact`,
  ].filter(Boolean) as string[];

  return queries.slice(0, 3);
}

function parseTavilyResults(
  results: Array<{ title?: string; url?: string; description?: string }>,
  company: Company,
  domain: string | null,
): DiscoveredContactCandidate[] {
  const candidates: DiscoveredContactCandidate[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const blob = `${result.title ?? ""} ${result.description ?? ""} ${result.url ?? ""}`;
    const emails = extractEmailsFromText(blob);

    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);

      const emailDomain = email.split("@")[1] ?? "";
      const onCompanyDomain = domain ? emailDomain === domain : false;
      const local = email.split("@")[0] ?? "";
      const isHr = /^(hr|recruitment|recruiter|vacatures|werkenbij|careers|jobs)/i.test(local);

      if (!onCompanyDomain && !isHr) continue;

      candidates.push({
        firstName: "Contact",
        lastName: company.name,
        fullName: null,
        email,
        phone: null,
        jobTitle: result.title?.slice(0, 120) ?? null,
        department: null,
        linkedinUrl: result.url?.includes("linkedin.com/in/") ? result.url : null,
        sourceUrl: result.url ?? null,
        sourceType: result.url?.includes("linkedin.com") ? "linkedin_public" : "tavily_search",
        emailOrigin: "extracted",
        isGeneralMailbox: isHr,
        isDecisionMaker: false,
        confidence: onCompanyDomain ? 0.7 : 0.55,
        externalId: `tavily:${email}:${result.url ?? "unknown"}`,
      });
    }
  }

  return candidates;
}

export async function searchTavilyContacts(
  company: Company,
): Promise<{ candidates: DiscoveredContactCandidate[]; queries: string[]; rawCount: number }> {
  const domain = companyDomain(company);
  const queries = buildQueries(company, domain);
  const allCandidates: DiscoveredContactCandidate[] = [];
  let rawCount = 0;

  for (const query of queries) {
    try {
      const { data } = await executeTavilySearch(query, 5);
      rawCount += data.length;
      allCandidates.push(...parseTavilyResults(data, company, domain));
    } catch {
      continue;
    }
  }

  const deduped = new Map<string, DiscoveredContactCandidate>();
  for (const candidate of allCandidates) {
    if (candidate.email) deduped.set(candidate.email, candidate);
  }

  return {
    candidates: [...deduped.values()],
    queries,
    rawCount,
  };
}
