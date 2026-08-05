import type { Company } from "@/features/companies/domain";
import type { EmailVerificationProvider } from "@/features/contact-finder/email-verification";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

const MAILBOX_PRIORITY = [
  "recruitment",
  "recruiter",
  "hr",
  "werkenbij",
  "vacatures",
  "careers",
  "jobs",
  "personeel",
  "info",
] as const;

function resolveDomain(company: Company): string | null {
  if (company.domain) return company.domain.toLowerCase().replace(/^www\./, "");
  if (!company.website) return null;
  try {
    const url = company.website.startsWith("http") ? company.website : `https://${company.website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function searchVerifiedGeneralMailboxes(
  company: Company,
  verifier: EmailVerificationProvider,
): Promise<DiscoveredContactCandidate[]> {
  const domain = resolveDomain(company);
  if (!domain) return [];

  const published = [company.hrEmail, company.generalEmail, company.email]
    .filter(Boolean)
    .map((e) => e!.trim().toLowerCase());

  const candidates: DiscoveredContactCandidate[] = [];

  for (const email of published) {
    const verification = await verifier.verify(email, domain);
    if (verification.status === "invalid") continue;

    const local = email.split("@")[0] ?? "";
    candidates.push({
      firstName: "Team",
      lastName: company.name,
      fullName: null,
      email,
      phone: null,
      jobTitle: "Gepubliceerde bedrijfsmailbox",
      department: null,
      linkedinUrl: null,
      sourceUrl: company.website,
      sourceType: "company_website",
      emailOrigin: "published",
      isGeneralMailbox: true,
      isDecisionMaker: false,
      confidence: 0.9,
      externalId: `published:${email}`,
      verification,
    });
    return candidates;
  }

  for (const prefix of MAILBOX_PRIORITY) {
    const email = `${prefix}@${domain}`;
    const verification = await verifier.verify(email, domain);
    if (verification.status === "invalid" || !verification.mxValid) continue;

    candidates.push({
      firstName: "Team",
      lastName: company.name,
      fullName: null,
      email,
      phone: null,
      jobTitle: `${prefix}@ mailbox (geverifieerd MX)`,
      department: null,
      linkedinUrl: null,
      sourceUrl: company.website,
      sourceType: "inferred",
      emailOrigin: "inferred",
      isGeneralMailbox: true,
      isDecisionMaker: false,
      confidence: 0.35,
      externalId: `inferred:${email}`,
      verification,
    });
    break;
  }

  return candidates;
}
