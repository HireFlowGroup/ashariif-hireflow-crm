#!/usr/bin/env npx tsx
/**
 * Development-only dry run: diagnose company identity issues.
 * Usage: npm run diagnose:company-identities
 * Does NOT write to production without explicit --apply flag.
 */

import { resolveOfficialCompanyIdentity } from "../src/features/company-finder/discovery/company-identity.service";
import { classifyBusinessModel } from "../src/features/company-finder/discovery/business-model-classifier.service";
import { isGenericCompanyLabel } from "../src/features/company-finder/discovery/generic-company-label";

type RepairRow = {
  prospectId: string;
  oldName: string;
  proposedName: string | null;
  domain: string | null;
  confidence: number;
  update: "yes" | "no";
  reason: string;
};

const SAMPLE_PROSPECTS = [
  {
    id: "sample-digitalimpact",
    name: "Software ontwikkelaar Rotterdam",
    website: "https://digitalimpact.nl",
  },
  {
    id: "sample-axs",
    name: "AXS ict Rotterdam",
    website: "https://www.axsict.nl",
  },
];

async function diagnoseProspect(input: {
  id: string;
  name: string;
  website: string;
}): Promise<RepairRow> {
  const identity = await resolveOfficialCompanyIdentity({
    searchTitle: input.name,
    url: input.website,
    fetchHtml: true,
  });

  const businessModel = classifyBusinessModel({
    name: identity.officialName ?? input.name,
    url: input.website,
    excludeRecruitmentAgencies: true,
  });

  const generic = isGenericCompanyLabel(input.name);
  const proposed = identity.officialName;
  const shouldUpdate =
    proposed
    && proposed !== input.name
    && identity.confidence >= (identity.confidence || 0)
    && identity.confidence >= 0.55
    && !isGenericCompanyLabel(proposed);

  let reason = identity.source;
  if (businessModel.classification.includes("competitor")) {
    reason = `${businessModel.classification}: ${businessModel.reasons.join("; ")}`;
  } else if (generic) {
    reason = `Generieke titel → ${identity.source}`;
  } else if (!shouldUpdate) {
    reason = "Geen betrouwbaardere naam gevonden";
  }

  return {
    prospectId: input.id,
    oldName: input.name,
    proposedName: proposed,
    domain: identity.domain,
    confidence: identity.confidence,
    update: shouldUpdate ? "yes" : "no",
    reason,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (apply) {
    console.error("Automatische productie-updates zijn uitgeschakeld. Gebruik alleen dry-run.");
    process.exit(1);
  }

  console.log("Company identity repair — DRY RUN\n");
  for (const prospect of SAMPLE_PROSPECTS) {
    const row = await diagnoseProspect(prospect);
    console.log(JSON.stringify(row, null, 2));
  }
}

void main();
