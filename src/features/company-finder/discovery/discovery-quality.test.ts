import { describe, expect, it } from "vitest";

import { applyDiscoveryHeuristics } from "@/features/company-finder/discovery/discovery-heuristics";
import {
  detectHomepageSignals,
  countHomepageSignals,
  hasCompanyAcceptanceSignal,
  countCompanyAcceptanceSignals,
} from "@/features/company-finder/discovery/homepage-signals";
import {
  DISCOVERY_ACCEPT_CONFIDENCE,
  DISCOVERY_MIN_SAVE_SCORE,
  DISCOVERY_REVIEW_CONFIDENCE_MIN,
  DISCOVERY_TYPE_SCORES,
} from "@/features/company-finder/discovery/discovery-quality.types";
import { parseAiDecisionText } from "@/features/company-finder/discovery/discovery-ai-classifier";

describe("applyDiscoveryHeuristics", () => {
  const highConfidenceBlocks = [
    { title: "Rotterdam", url: "https://www.gemeente-rotterdam.nl/", reason: "government" },
    { title: "Article", url: "https://example.com/blog/post", reason: "blog" },
    { title: "Nieuws", url: "https://nu.nl/nieuws/it", reason: "news" },
    { title: "Jobs", url: "https://www.indeed.nl/viewjob?jk=1", reason: "jobboard" },
    { title: "Gids", url: "https://www.bedrijvengids.nl/rotterdam", reason: "directory" },
    { title: "Wiki", url: "https://nl.wikipedia.org/wiki/Rotterdam", reason: "wikipedia" },
    { title: "Discussie", url: "https://forum.example.nl/t/123", reason: "forum" },
  ];

  for (const sample of highConfidenceBlocks) {
    it(`blocks high-confidence non-company: ${sample.reason}`, () => {
      const result = applyDiscoveryHeuristics({
        url: sample.url,
        title: sample.title,
      });

      expect(result.rejected).toBe(true);
      expect(result.highConfidence).toBe(true);
      expect(result.reason).toBe(sample.reason);
    });
  }

  it("does not reject plausible company homepage on weak title heuristics", () => {
    const result = applyDiscoveryHeuristics({
      url: "https://www.acme-software.nl/",
      title: "Welcome to Acme Software",
    });

    expect(result.rejected).toBe(false);
  });

  it("allows company named after a city in the title", () => {
    const result = applyDiscoveryHeuristics({
      url: "https://www.rotterdam-logistics.nl/",
      title: "Rotterdam Logistics BV",
    });

    expect(result.rejected).toBe(false);
  });

  it("allows plausible company homepage", () => {
    const result = applyDiscoveryHeuristics({
      url: "https://www.acme-software.nl/",
      title: "Acme Software BV | IT oplossingen",
    });

    expect(result.rejected).toBe(false);
  });
});

describe("detectHomepageSignals", () => {
  it("detects company acceptance signals including email", () => {
    const html = `
      <html>
        <body>
          <a href="/over-ons">Over ons</a>
          <a href="/contact">Contact</a>
          <a href="https://linkedin.com/company/acme">LinkedIn</a>
          <footer>KvK 12345678 | info@acme-software.nl</footer>
          <p>Bezoek ons op Keizersgracht 1, 1015 AA Amsterdam</p>
          <p>Bel +31 20 123 4567</p>
        </body>
      </html>
    `;

    const signals = detectHomepageSignals(html);
    expect(countHomepageSignals(signals)).toBeGreaterThanOrEqual(6);
    expect(hasCompanyAcceptanceSignal(signals)).toBe(true);
    expect(countCompanyAcceptanceSignals(signals)).toBeGreaterThanOrEqual(1);
    expect(signals.email).toBe(true);
    expect(signals.contact).toBe(true);
    expect(signals.kvk).toBe(true);
  });

  it("accepts company with only one acceptance signal", () => {
    const html = `<html><body><a href="/contact">Contact</a></body></html>`;
    const signals = detectHomepageSignals(html);
    expect(hasCompanyAcceptanceSignal(signals)).toBe(true);
  });

  it("returns no acceptance signals for bare article page", () => {
    const html = `<html><body><h1>Top 10 beste bedrijven</h1><p>Lees ons artikel.</p></body></html>`;
    const signals = detectHomepageSignals(html);
    expect(hasCompanyAcceptanceSignal(signals)).toBe(false);
    expect(countHomepageSignals(signals)).toBeLessThan(2);
  });
});

describe("AI decision parsing", () => {
  it("parses exclusive company answer with confidence", () => {
    const parsed = parseAiDecisionText(`company\n\nConfidence: 88`);
    expect(parsed.verdict).toBe("company");
    expect(parsed.confidence).toBe(88);
  });

  it("parses not_company", () => {
    const parsed = parseAiDecisionText(`not_company\nConfidence: 12`);
    expect(parsed.verdict).toBe("not_company");
    expect(parsed.confidence).toBe(12);
  });
});

describe("confidence thresholds", () => {
  it("defines accept (>70) and review (50-70) bands", () => {
    expect(DISCOVERY_ACCEPT_CONFIDENCE).toBe(70);
    expect(DISCOVERY_REVIEW_CONFIDENCE_MIN).toBe(50);
    expect(DISCOVERY_TYPE_SCORES.company_website).toBeGreaterThan(DISCOVERY_ACCEPT_CONFIDENCE);
    expect(DISCOVERY_TYPE_SCORES.directory).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.news).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.government).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.spam).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
  });
});

describe("evaluateDiscoveryDecision", () => {
  it("always accepts AI confidence > 70 even without signals", async () => {
    const { evaluateDiscoveryDecision } = await import(
      "@/features/company-finder/discovery/discovery-decision"
    );
    const result = evaluateDiscoveryDecision({
      verdict: "company",
      confidence: 85,
      hasCompanyAcceptanceSignal: false,
    });
    expect(result.action).toBe("accept");
    if (result.action === "accept") expect(result.saveStatus).toBe("company");
  });

  it("saves mid-confidence with signals as Review", async () => {
    const { evaluateDiscoveryDecision } = await import(
      "@/features/company-finder/discovery/discovery-decision"
    );
    const result = evaluateDiscoveryDecision({
      verdict: "company",
      confidence: 62,
      hasCompanyAcceptanceSignal: true,
    });
    expect(result.action).toBe("accept");
    if (result.action === "accept") expect(result.saveStatus).toBe("review");
  });

  it("rejects mid-confidence without company signals", async () => {
    const { evaluateDiscoveryDecision } = await import(
      "@/features/company-finder/discovery/discovery-decision"
    );
    const result = evaluateDiscoveryDecision({
      verdict: "company",
      confidence: 55,
      hasCompanyAcceptanceSignal: false,
    });
    expect(result.action).toBe("reject");
    if (result.action === "reject") expect(result.reason).toBe("missing_company_signals");
  });

  it("rejects low confidence", async () => {
    const { evaluateDiscoveryDecision } = await import(
      "@/features/company-finder/discovery/discovery-decision"
    );
    const result = evaluateDiscoveryDecision({
      verdict: "company",
      confidence: 40,
      hasCompanyAcceptanceSignal: true,
    });
    expect(result.action).toBe("reject");
    if (result.action === "reject") expect(result.reason).toBe("low_confidence");
  });

  it("keeps real companies from a typical aggressive-filter batch", async () => {
    const { evaluateDiscoveryDecision } = await import(
      "@/features/company-finder/discovery/discovery-decision"
    );
    const { applyDiscoveryHeuristics } = await import(
      "@/features/company-finder/discovery/discovery-heuristics"
    );

    // Simulates the reported run: 15 URLs → previously 13 rejected / 0 companies.
    const batch = [
      { url: "https://nl.wikipedia.org/wiki/Bedrijf", title: "Wikipedia", ai: null },
      { url: "https://www.gemeente-rotterdam.nl/", title: "Gemeente", ai: null },
      { url: "https://nu.nl/nieuws/tech", title: "Nieuws", ai: null },
      { url: "https://example.com/blog/post", title: "Blog", ai: null },
      { url: "https://www.indeed.nl/viewjob?jk=1", title: "Vacature", ai: null },
      { url: "https://www.bedrijvengids.nl/list", title: "Directory", ai: null },
      { url: "https://forum.example.nl/t/1", title: "Forum", ai: null },
      { url: "https://www.acme-software.nl/", title: "Acme Software", ai: { verdict: "company" as const, confidence: 88, signal: true } },
      { url: "https://www.bright-logistics.nl/", title: "Bright Logistics", ai: { verdict: "company" as const, confidence: 76, signal: true } },
      { url: "https://www.delta-bouw.nl/", title: "Delta Bouw", ai: { verdict: "company" as const, confidence: 64, signal: true } },
      { url: "https://www.nova-it.nl/", title: "Nova IT", ai: { verdict: "company" as const, confidence: 71, signal: false } },
      { url: "https://www.harbor-agency.nl/", title: "Harbor", ai: { verdict: "company" as const, confidence: 58, signal: false } },
      { url: "https://www.weak-signal.nl/", title: "Weak", ai: { verdict: "company" as const, confidence: 42, signal: true } },
      { url: "https://www.not-a-firm.nl/", title: "Listicle", ai: { verdict: "not_company" as const, confidence: 18, signal: false } },
      { url: "https://www.acme-software.nl/about", title: "Acme Software About", ai: { verdict: "company" as const, confidence: 90, signal: true } },
    ];

    let companies = 0;
    let review = 0;
    let rejected = 0;
    const seen = new Set<string>();

    for (const item of batch) {
      const host = new URL(item.url).hostname.replace(/^www\./, "");
      if (seen.has(host)) {
        rejected += 1;
        continue;
      }
      seen.add(host);

      const heuristic = applyDiscoveryHeuristics({ url: item.url, title: item.title });
      if (heuristic.rejected) {
        rejected += 1;
        continue;
      }

      if (!item.ai) {
        rejected += 1;
        continue;
      }

      const decision = evaluateDiscoveryDecision({
        verdict: item.ai.verdict,
        confidence: item.ai.confidence,
        hasCompanyAcceptanceSignal: item.ai.signal,
      });

      if (decision.action === "reject") {
        rejected += 1;
      } else if (decision.saveStatus === "review") {
        review += 1;
        companies += 1;
      } else {
        companies += 1;
      }
    }

    // Previously: 0 real companies. Now real firms survive.
    expect(companies).toBeGreaterThanOrEqual(4);
    expect(review).toBeGreaterThanOrEqual(1);
    expect(rejected).toBeGreaterThan(0);
    expect(companies + rejected).toBe(batch.length);
  });
});
