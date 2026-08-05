import type { Company } from "@/features/companies/domain";
import type { EmailVerificationProvider } from "@/features/contact-finder/email-verification";
import {
  MAILBOX_FALLBACK_PREFIXES,
  pickBestMailboxEmail,
} from "@/features/contact-finder/domain/contact-role-priority";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

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

function mailboxCandidate(
  company: Company,
  email: string,
  verification: Awaited<ReturnType<EmailVerificationProvider["verify"]>>,
  emailOrigin: DiscoveredContactCandidate["emailOrigin"],
  sourceType: DiscoveredContactCandidate["sourceType"],
  confidence: number,
): DiscoveredContactCandidate {
  const local = email.split("@")[0] ?? "";
  return {
    firstName: "Team",
    lastName: company.name,
    fullName: null,
    email,
    phone: null,
    jobTitle: `${local}@ mailbox`,
    department: null,
    linkedinUrl: null,
    sourceUrl: company.website,
    sourceType,
    emailOrigin,
    isGeneralMailbox: true,
    isDecisionMaker: false,
    confidence,
    externalId: `${emailOrigin}:${email}`,
    verification,
  };
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

  const bestPublished = pickBestMailboxEmail(published);
  if (bestPublished) {
    const verification = await verifier.verify(bestPublished, domain);
    if (verification.status !== "invalid") {
      return [
        mailboxCandidate(company, bestPublished, verification, "published", "company_website", 0.9),
      ];
    }
  }

  for (const prefix of MAILBOX_FALLBACK_PREFIXES) {
    const email = `${prefix}@${domain}`;
    const verification = await verifier.verify(email, domain);
    if (verification.status === "invalid" || !verification.mxValid) continue;

    return [mailboxCandidate(company, email, verification, "inferred", "inferred", 0.35)];
  }

  return [];
}
