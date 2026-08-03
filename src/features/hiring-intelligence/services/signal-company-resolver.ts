import type { Company } from "@/features/companies/domain";
import type { IncomingHiringSignal } from "@/features/hiring-intelligence/domain/signal-types";
import { normalizeCompanyName } from "@/features/lead-intelligence/services/recruitment-normalize";

export function matchSignalToCompany(
  signal: IncomingHiringSignal,
  companies: Company[],
): Company | null {
  if (signal.companyId) {
    return companies.find((company) => (company.id as string) === signal.companyId) ?? null;
  }

  const hint = signal.companyHint;
  if (!hint) return null;

  const normalizedHint = normalizeCompanyName(hint.normalizedName ?? hint.name);

  if (hint.domain) {
    const byDomain = companies.find(
      (company) => company.domain?.toLowerCase() === hint.domain!.toLowerCase(),
    );
    if (byDomain) return byDomain;
  }

  if (hint.linkedinUrl) {
    const byLinkedIn = companies.find(
      (company) => company.linkedinUrl?.split("?")[0] === hint.linkedinUrl!.split("?")[0],
    );
    if (byLinkedIn) return byLinkedIn;
  }

  const byName = companies.find(
    (company) => normalizeCompanyName(company.name) === normalizedHint,
  );

  if (byName) return byName;

  if (hint.city) {
    return (
      companies.find(
        (company) =>
          normalizeCompanyName(company.name) === normalizedHint &&
          company.city?.toLowerCase() === hint.city!.toLowerCase(),
      ) ?? null
    );
  }

  return null;
}

export function buildCreateCompanyFromSignal(
  signal: IncomingHiringSignal,
  ownerId: string,
): import("@/features/companies/domain").CreateCompanyInput {
  const hint = signal.companyHint;
  const fields = signal.extractedFields ?? {};

  return {
    name: (fields.name as string) ?? hint?.name ?? signal.title,
    ownerId,
    website: (fields.website as string) ?? hint?.website ?? signal.url,
    domain: (fields.domain as string) ?? hint?.domain ?? null,
    linkedinUrl: (fields.linkedin_url as string) ?? hint?.linkedinUrl ?? null,
    sector: (fields.sector as string) ?? hint?.sector ?? null,
    city: (fields.city as string) ?? hint?.city ?? null,
    region: (fields.region as string) ?? hint?.region ?? null,
    province: (fields.province as string) ?? hint?.region ?? null,
    country: (fields.country as string) ?? "NL",
    source: signal.source,
    sourceUrl: signal.url,
    confidence: signal.confidence,
    status: "prospect",
  };
}
