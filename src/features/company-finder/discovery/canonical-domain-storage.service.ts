import { resolveOfficialDomain } from "@/features/company-finder/discovery/discovery-domain-blocklist";
import { extractDomain } from "@/features/lead-intelligence/services/normalize";

/**
 * Registrable domains where many unrelated employers share a hostname.
 * Excluded from DB unique (organization_id, canonical_domain) — fuzzy/manual review only.
 */
const SHARED_HOSTING_DOMAIN_SUFFIXES = [
  "github.io",
  "wordpress.com",
  "wixsite.com",
  "blogspot.com",
  "squarespace.com",
  "azurewebsites.net",
  "herokuapp.com",
  "myshopify.com",
];

function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

export function isSharedHostingDomain(canonicalDomain: string | null): boolean {
  if (!canonicalDomain) return false;
  const host = stripWww(canonicalDomain);
  return SHARED_HOSTING_DOMAIN_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Value intended for `companies.canonical_domain` (nullable).
 * Prefers explicit domain, then official employer domain from website (not job boards).
 */
export function canonicalDomainForStorage(input: {
  website?: string | null;
  domain?: string | null;
}): string | null {
  const fromField = input.domain?.trim();
  const raw =
    fromField
      ? stripWww(fromField)
      : resolveOfficialDomain(input.website ?? "") ?? extractDomain(input.website);

  if (!raw) return null;
  const canonical = stripWww(raw);
  if (!canonical || canonical.length < 3) return null;
  if (isSharedHostingDomain(canonical)) return null;
  return canonical;
}

/** Whether this domain may participate in a partial unique constraint per organization. */
export function isCanonicalDomainUniqueEligible(canonicalDomain: string | null): boolean {
  return Boolean(canonicalDomain && !isSharedHostingDomain(canonicalDomain));
}