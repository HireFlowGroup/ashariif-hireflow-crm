import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";
import { extractDomain } from "@/features/lead-intelligence/services/normalize";

export type DiscoveryCompanySaveValidation = {
  acceptable: boolean;
  reason: "generic_label" | "missing_domain" | null;
};

/** Blocks generic SEO labels and companies without a credible domain at save time. */
export function validateDiscoveryCompanyForSave(input: {
  name: string;
  domain?: string | null;
  website?: string | null;
}): DiscoveryCompanySaveValidation {
  const trimmedName = input.name.trim();
  if (!trimmedName || isGenericCompanyLabel(trimmedName)) {
    return { acceptable: false, reason: "generic_label" };
  }

  const domain = (input.domain ?? extractDomain(input.website ?? null) ?? "").trim();
  if (!domain || domain.includes(" ")) {
    return { acceptable: false, reason: "missing_domain" };
  }

  return { acceptable: true, reason: null };
}
