import { describe, expect, it } from "vitest";

import { resolveOfficialCompanyIdentity } from "@/features/company-finder/discovery/company-identity.service";
import {
  classifyBusinessModel,
  isExcludedBusinessModel,
} from "@/features/company-finder/discovery/business-model-classifier.service";
import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";
import {
  extractSchemaOrgOrganizationName,
  brandNameFromDomain,
} from "@/features/company-finder/discovery/parse-website-identity";
import {
  mapScoreToDecision,
  prospectDecisionToBreakdownFields,
  PROSPECT_SCORING_VERSION,
} from "@/features/ai-recruiter/services/prospect-decision.service";

describe("company identity and decision quality", () => {
  it("1. Software ontwikkelaar Rotterdam wordt als generieke titel afgewezen", () => {
    expect(isGenericCompanyLabel("Software ontwikkelaar Rotterdam")).toBe(true);
  });

  it("2. digitalimpact.nl levert organisatienaam uit website-evidence", async () => {
    const html = `
      <html><head>
        <meta property="og:site_name" content="Digital Impact" />
        <script type="application/ld+json">{"@type":"Organization","name":"Digital Impact"}</script>
      </head><body></body></html>`;
    const identity = await resolveOfficialCompanyIdentity({
      searchTitle: "Software ontwikkelaar Rotterdam",
      url: "https://digitalimpact.nl",
      html,
      fetchHtml: false,
    });
    expect(identity.officialName).toBe("Digital Impact");
    expect(identity.confidence).toBeGreaterThan(0.8);
  });

  it("3. zoekresultaattitel heeft lagere prioriteit dan Organization.name", async () => {
    const html = `<script>{"@type":"Organization","name":"Betabit"}</script>`;
    const identity = await resolveOfficialCompanyIdentity({
      searchTitle: "Software bedrijf Rotterdam",
      url: "https://betabit.nl",
      html,
      fetchHtml: false,
    });
    expect(identity.officialName).toBe("Betabit");
    expect(identity.source).toContain("schema.org");
  });

  it("4. vacaturetitel wordt geen bedrijfsnaam", () => {
    expect(isGenericCompanyLabel("Customer Success Manager in Netherlands")).toBe(true);
  });

  it("5. recruitmentbedrijf wordt als concurrent geclassificeerd", () => {
    const result = classifyBusinessModel({
      name: "IT Recruitment Specialists",
      description: "Recruitment agency in the Netherlands",
    });
    expect(result.classification).toBe("recruitment_competitor");
    expect(isExcludedBusinessModel(result.classification)).toBe(true);
  });

  it("6. IT-detacheerder AXS ict wordt uitgesloten", () => {
    const result = classifyBusinessModel({
      name: "AXS ict Rotterdam",
      description: "IT staffing and detachering voor professionals",
    });
    expect(result.classification).toBe("staffing_competitor");
    expect(isExcludedBusinessModel(result.classification)).toBe(true);
  });

  it("7. normaal softwarebedrijf blijft potential_client", () => {
    const result = classifyBusinessModel({
      name: "Yellow Yard",
      description: "Software development company in Rotterdam",
      sector: "software",
    });
    expect(result.classification).toBe("potential_client");
  });

  it("8. score 72 geeft WARM en priority B", () => {
    const decision = mapScoreToDecision(72);
    expect(decision.decision).toBe("WARM");
    expect(decision.priority).toBe("B");
  });

  it("9. score 25 geeft IGNORE", () => {
    const decision = mapScoreToDecision(25);
    expect(decision.decision).toBe("IGNORE");
    expect(decision.priority).toBe("LOW");
  });

  it("10. UI/backend breakdown velden komen uit dezelfde mapping", () => {
    const fields = prospectDecisionToBreakdownFields(mapScoreToDecision(72));
    expect(fields.decision).toBe("WARM");
    expect(fields.priority).toBe("B");
    expect(fields.scoringVersion).toBe(PROSPECT_SCORING_VERSION);
  });

  it("11. score herberekening levert nieuwe decision", () => {
    const oldDecision = mapScoreToDecision(20);
    const newDecision = mapScoreToDecision(72);
    expect(oldDecision.decision).toBe("IGNORE");
    expect(newDecision.decision).toBe("WARM");
  });

  it("12. unresolved identity wanneer alleen generieke titel", async () => {
    const identity = await resolveOfficialCompanyIdentity({
      searchTitle: "Software ontwikkelaar Rotterdam",
      url: "https://example-unknown.test",
      html: null,
      fetchHtml: false,
    });
    expect(identity.unresolved || isGenericCompanyLabel(identity.officialName)).toBeTruthy();
  });

  it("13. uitgesloten concurrent blijft classificeerbaar in diagnostics", () => {
    const result = classifyBusinessModel({ name: "Robert Half", description: "Recruitment agency" });
    expect(result.classification).toBe("recruitment_competitor");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("14. identity repair overschrijft niet met lagere confidence titel", async () => {
    const html = `<meta property="og:site_name" content="Digital Impact" />`;
    const high = await resolveOfficialCompanyIdentity({
      searchTitle: "Software ontwikkelaar Rotterdam",
      url: "https://digitalimpact.nl",
      html,
      fetchHtml: false,
    });
    expect(high.confidence).toBeGreaterThan(0.5);
    expect(high.officialName).not.toBe("Software ontwikkelaar Rotterdam");
  });

  it("15. decision en score worden atomair gemapped", () => {
    const result = mapScoreToDecision(85);
    expect(result.score).toBe(85);
    expect(result.decision).toBe("HOT");
    expect(result.evaluatedAt).toBeTruthy();
  });

  it("16. review queue zou IGNORE uitsluiten via decision veld", () => {
    const decision = mapScoreToDecision(72);
    expect(decision.decision).not.toBe("IGNORE");
  });

  it("17. review queue sluit concurrenten uit", () => {
    const axs = classifyBusinessModel({ name: "AXS ict", description: "detachering IT" });
    expect(isExcludedBusinessModel(axs.classification)).toBe(true);
  });

  it("18. previous_name audit via rejectedNames", async () => {
    const identity = await resolveOfficialCompanyIdentity({
      searchTitle: "Software ontwikkelaar Rotterdam",
      url: "https://digitalimpact.nl",
      html: `<meta property="og:site_name" content="Digital Impact" />`,
      fetchHtml: false,
    });
    expect(identity.rejectedNames.some((r) => r.value.includes("Software ontwikkelaar"))).toBe(true);
  });

  it("schema.org parser werkt standalone", () => {
    const name = extractSchemaOrgOrganizationName('{"@type":"Organization","name":"Digital Impact"}');
    expect(name).toBe("Digital Impact");
  });

  it("domain stem levert fallback merknaam", () => {
    expect(brandNameFromDomain("digitalimpact.nl")).toBe("Digitalimpact");
  });
});
