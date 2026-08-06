import "server-only";

import { resolveOfficialDomain } from "@/features/company-finder/discovery/discovery-domain-blocklist";
import type { OfficialCompanyIdentity } from "@/features/company-finder/discovery/company-identity.types";
import {
  genericLabelReason,
  isGenericCompanyLabel,
} from "@/features/company-finder/discovery/generic-company-label";
import {
  brandNameFromDomain,
  extractFooterBrandName,
  extractHtmlTitle,
  extractLegalNameFromLegalPages,
  extractSchemaOrgOrganizationName,
} from "@/features/company-finder/discovery/parse-website-identity";
import { fetchHomepageHtml } from "@/features/company-finder/discovery/homepage-signals";

export type { OfficialCompanyIdentity, IdentityEvidence, RejectedName } from "@/features/company-finder/discovery/company-identity.types";

function pickBestName(candidates: Array<{ value: string; type: string; weight: number; url?: string }>): {
  name: string | null;
  source: string;
  confidence: number;
  evidence: OfficialCompanyIdentity["evidence"];
} {
  const sorted = [...candidates].sort((a, b) => b.weight - a.weight);
  const best = sorted[0];
  if (!best) return { name: null, source: "none", confidence: 0, evidence: [] };

  return {
    name: best.value,
    source: best.type,
    confidence: Math.min(0.98, best.weight / 100),
    evidence: sorted.slice(0, 6).map((entry) => ({
      type: entry.type,
      value: entry.value,
      url: entry.url,
      weight: entry.weight,
    })),
  };
}

export async function resolveOfficialCompanyIdentity(input: {
  searchTitle?: string | null;
  url: string;
  description?: string | null;
  html?: string | null;
  fetchHtml?: boolean;
  timeoutMs?: number;
}): Promise<OfficialCompanyIdentity> {
  const domain = resolveOfficialDomain(input.url);
  const rejectedNames: OfficialCompanyIdentity["rejectedNames"] = [];
  const candidates: Array<{ value: string; type: string; weight: number; url?: string }> = [];

  let html = input.html ?? null;
  if (!html && input.fetchHtml !== false && input.url) {
    try {
      html = await fetchHomepageHtml(input.url, input.timeoutMs ?? 8000);
    } catch {
      html = null;
    }
  }

  if (html) {
    const schemaName = extractSchemaOrgOrganizationName(html);
    if (schemaName && !isGenericCompanyLabel(schemaName)) {
      candidates.push({ value: schemaName, type: "schema.org Organization.name", weight: 95, url: input.url });
    } else if (schemaName) {
      rejectedNames.push({ value: schemaName, reason: genericLabelReason(schemaName) });
    }

    const legalName = extractLegalNameFromLegalPages(html);
    if (legalName && !isGenericCompanyLabel(legalName)) {
      candidates.push({ value: legalName, type: "legal_name_privacy", weight: 88, url: input.url });
    }

    const footerName = extractFooterBrandName(html);
    if (footerName && !isGenericCompanyLabel(footerName)) {
      candidates.push({ value: footerName, type: "footer_brand", weight: 72, url: input.url });
    }

    const htmlTitle = extractHtmlTitle(html);
    if (htmlTitle && !isGenericCompanyLabel(htmlTitle)) {
      candidates.push({ value: htmlTitle, type: "html_title", weight: 65, url: input.url });
    } else if (htmlTitle) {
      rejectedNames.push({ value: htmlTitle, reason: genericLabelReason(htmlTitle) });
    }
  }

  const domainBrand = brandNameFromDomain(domain);
  if (domainBrand && !isGenericCompanyLabel(domainBrand)) {
    candidates.push({ value: domainBrand, type: "domain_stem", weight: 55, url: input.url });
  }

  const searchTitle = input.searchTitle?.trim();
  if (searchTitle) {
    if (isGenericCompanyLabel(searchTitle)) {
      rejectedNames.push({ value: searchTitle, reason: genericLabelReason(searchTitle) });
    } else {
      candidates.push({ value: searchTitle, type: "search_result_title", weight: 35, url: input.url });
    }
  }

  const picked = pickBestName(candidates);
  const hadGenericSearchTitle = Boolean(
    searchTitle && rejectedNames.some((entry) => entry.value === searchTitle),
  );
  const domainOnlyFallback = picked.source === "domain_stem" && hadGenericSearchTitle;
  const unresolved =
    !picked.name
    || picked.confidence < 0.55
    || isGenericCompanyLabel(picked.name)
    || domainOnlyFallback;

  return {
    officialName: unresolved ? null : picked.name,
    tradingName: picked.name,
    legalName: candidates.find((c) => c.type === "legal_name_privacy")?.value ?? null,
    domain,
    source: picked.source,
    confidence: picked.confidence,
    evidence: picked.evidence,
    rejectedNames,
    unresolved,
  };
}
