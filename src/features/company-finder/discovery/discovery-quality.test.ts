import { describe, expect, it } from "vitest";

import { applyDiscoveryHeuristics } from "@/features/company-finder/discovery/discovery-heuristics";
import { detectHomepageSignals, countHomepageSignals } from "@/features/company-finder/discovery/homepage-signals";
import { DISCOVERY_MIN_SAVE_SCORE, DISCOVERY_TYPE_SCORES } from "@/features/company-finder/discovery/discovery-quality.types";

describe("applyDiscoveryHeuristics", () => {
  const badExamples = [
    { title: "Welcome to Rotterdam", url: "https://www.rotterdam.nl/welcome", category: "government" },
    { title: "Rotterdam", url: "https://www.rotterdam.nl/", category: "government" },
    { title: "Top 250", url: "https://example.com/top-250", category: "listing" },
    { title: "Bedrijven Rotterdam", url: "https://gids.nl/bedrijven-rotterdam", category: "directory" },
    { title: "Nieuws over IT", url: "https://nu.nl/nieuws/it", category: "news" },
    { title: "Best Blog", url: "https://medium.com/blog/post", category: "blog" },
    { title: "Company List", url: "https://example.com/list/software", category: "directory" },
  ];

  for (const sample of badExamples) {
    it(`rejects "${sample.title}"`, () => {
      const result = applyDiscoveryHeuristics({
        url: sample.url,
        title: sample.title,
      });

      expect(result.rejected).toBe(true);
      expect(result.category).toBeDefined();
    });
  }

  it("allows plausible company homepage", () => {
    const result = applyDiscoveryHeuristics({
      url: "https://www.acme-software.nl/",
      title: "Acme Software BV | IT oplossingen",
    });

    expect(result.rejected).toBe(false);
  });
});

describe("detectHomepageSignals", () => {
  it("detects multiple business signals on company homepage HTML", () => {
    const html = `
      <html>
        <body>
          <a href="/over-ons">Over ons</a>
          <a href="/contact">Contact</a>
          <a href="/vacatures">Vacatures</a>
          <a href="https://linkedin.com/company/acme">LinkedIn</a>
          <footer>KvK 12345678 | BTW NL123456789B01</footer>
          <p>Bezoek ons op Keizersgracht 1, 1015 AA Amsterdam</p>
          <p>Bel +31 20 123 4567</p>
          <a href="/privacy">Privacyverklaring</a>
          <a href="/cookies">Cookies</a>
        </body>
      </html>
    `;

    const signals = detectHomepageSignals(html);
    expect(countHomepageSignals(signals)).toBeGreaterThanOrEqual(6);
  });

  it("returns low signal count for article page", () => {
    const html = `<html><body><h1>Top 10 beste bedrijven</h1><p>Lees ons artikel.</p></body></html>`;
    const signals = detectHomepageSignals(html);
    expect(countHomepageSignals(signals)).toBeLessThan(2);
  });
});

describe("DISCOVERY_TYPE_SCORES", () => {
  it("blocks saves below threshold", () => {
    expect(DISCOVERY_TYPE_SCORES.company_website).toBeGreaterThanOrEqual(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.directory).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.news).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.government).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
    expect(DISCOVERY_TYPE_SCORES.spam).toBeLessThan(DISCOVERY_MIN_SAVE_SCORE);
  });
});
