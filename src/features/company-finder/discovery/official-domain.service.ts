import {
  isBlockedOfficialDomain,
  resolveOfficialDomain,
} from "@/features/company-finder/discovery/discovery-domain-blocklist";

export type OfficialDomainResult = {
  officialDomain: string | null;
  domainConfidence: number;
  domainSource: string;
  domainValidationReason: string;
};

export function validateOfficialDomain(input: {
  companyName: string;
  url: string;
  title?: string;
}): OfficialDomainResult {
  const domain = resolveOfficialDomain(input.url);

  if (!domain) {
    return {
      officialDomain: null,
      domainConfidence: 0,
      domainSource: "none",
      domainValidationReason: isBlockedOfficialDomain(input.url)
        ? "URL is vacatureplatform, directory of social media — geen officiële site"
        : "Geen geldig domein uit URL",
    };
  }

  const nameLower = input.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domainStem = domain.split(".")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";

  const nameMatch =
    nameLower.length >= 3
    && (domainStem.includes(nameLower.slice(0, Math.min(6, nameLower.length)))
      || nameLower.includes(domainStem.slice(0, Math.min(6, domainStem.length))));

  return {
    officialDomain: domain,
    domainConfidence: nameMatch ? 0.85 : 0.65,
    domainSource: "result_url",
    domainValidationReason: nameMatch
      ? "Domein stemt overeen met bedrijfsnaam"
      : "Domein gevonden maar beperkte naamovereenkomst",
  };
}

export function buildCompanyWebsiteUrl(domain: string): string {
  return domain.startsWith("http") ? domain : `https://${domain}`;
}
