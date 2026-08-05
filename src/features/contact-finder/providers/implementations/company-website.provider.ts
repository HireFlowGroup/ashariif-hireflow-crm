import type { Company } from "@/features/companies/domain";
import { extractEmailsFromText } from "@/features/lead-intelligence/services/recruitment-normalize";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contactgegevens",
  "/over-ons",
  "/about",
  "/team",
  "/medewerkers",
  "/werken-bij",
  "/vacatures",
  "/careers",
  "/jobs",
];

const HR_LOCAL_PARTS = ["recruitment", "recruiter", "hr", "werkenbij", "vacatures", "careers", "jobs", "info", "personeel"];

function normalizeWebsiteUrl(website: string): string {
  return website.startsWith("http") ? website : `https://${website}`;
}

function extractDomain(website: string | null, domain: string | null): string | null {
  if (domain) return domain.toLowerCase().replace(/^www\./, "");
  if (!website) return null;
  try {
    return new URL(normalizeWebsiteUrl(website)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "HireFlow-ContactDiscovery/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, 300_000);
  } catch {
    return null;
  }
}

function emailsFromHtml(html: string, companyDomain: string | null): DiscoveredContactCandidate[] {
  const emails = extractEmailsFromText(html);
  const results: DiscoveredContactCandidate[] = [];

  for (const email of emails) {
    const local = email.split("@")[0] ?? "";
    const domain = email.split("@")[1] ?? "";
    const onCompanyDomain = companyDomain ? domain === companyDomain : true;
    const isHrMailbox = HR_LOCAL_PARTS.some((p) => local.startsWith(p));
    const isGeneric = /^(info|contact|hello|mail|office)@/.test(email);

    if (!onCompanyDomain && !isHrMailbox) continue;

    results.push({
      firstName: isHrMailbox || isGeneric ? "Team" : "Contact",
      lastName: isHrMailbox || isGeneric ? companyDomain ?? "Bedrijf" : "",
      fullName: null,
      email,
      phone: null,
      jobTitle: isHrMailbox ? "Recruitment/HR mailbox" : null,
      department: null,
      linkedinUrl: null,
      sourceUrl: null,
      sourceType: "company_website",
      emailOrigin: "published",
      isGeneralMailbox: isHrMailbox || isGeneric,
      isDecisionMaker: false,
      confidence: onCompanyDomain ? 0.85 : 0.6,
      externalId: `website:${email}`,
    });
  }

  return results;
}

export async function searchCompanyWebsiteContacts(
  company: Company,
  timeoutMs = 8000,
): Promise<{ candidates: DiscoveredContactCandidate[]; pagesFetched: number; sourceUrl: string | null }> {
  const website = company.website;
  const companyDomain = extractDomain(website, company.domain);

  if (!website && !companyDomain) {
    return { candidates: [], pagesFetched: 0, sourceUrl: null };
  }

  const baseUrl = website ? normalizeWebsiteUrl(website) : `https://${companyDomain}`;
  const urls = [baseUrl, ...CONTACT_PATHS.map((path) => `${baseUrl.replace(/\/$/, "")}${path}`)];

  const seen = new Set<string>();
  const candidates: DiscoveredContactCandidate[] = [];
  let pagesFetched = 0;
  let sourceUrl: string | null = null;

  for (const url of urls.slice(0, 6)) {
    const html = await fetchHtml(url, timeoutMs);
    if (!html) continue;
    pagesFetched += 1;
    sourceUrl = sourceUrl ?? url;

    for (const candidate of emailsFromHtml(html, companyDomain)) {
      if (!candidate.email || seen.has(candidate.email)) continue;
      seen.add(candidate.email);
      candidates.push({ ...candidate, sourceUrl: url });
    }

    if (candidates.length >= 8) break;
  }

  return { candidates, pagesFetched, sourceUrl };
}
