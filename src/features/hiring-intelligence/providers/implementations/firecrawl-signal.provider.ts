import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { isFirecrawlConfigured } from "@/features/lead-intelligence/clients/firecrawl.client";
import type { IncomingHiringSignal } from "@/features/hiring-intelligence/domain/signal-types";
import type { HiringSignalProvider } from "@/features/hiring-intelligence/providers/types";
import {
  buildSignalQuery,
  searchForSignals,
} from "@/features/hiring-intelligence/providers/shared/search-signal.mapper";
import {
  detectAtsFromHtml,
  enrichIncomingSignal,
} from "@/features/hiring-intelligence/services/signal-scoring";
import { getDefaultConfidence } from "@/features/hiring-intelligence/domain/signal-types";
import {
  cleanCompanyTitle,
  extractDomain,
  normalizeCompanyName,
} from "@/features/lead-intelligence/services/recruitment-normalize";
import { HIRING_PAGE_KEYWORDS } from "@/features/lead-intelligence/domain";

export const firecrawlSignalProvider: HiringSignalProvider = {
  id: "signals-firecrawl",
  displayName: "Firecrawl",
  order: 7,
  enabled: isFirecrawlConfigured(),
  skipReason: isFirecrawlConfigured() ? undefined : "FIRECRAWL_API_KEY niet geconfigureerd",

  async collectSignals(criteria, context) {
    const discoveryQuery = buildSignalQuery(criteria, "officiële website careers vacatures");
    const perProviderLimit = context.maxResultsPerProvider ?? Math.min(context.maxResults, 8);
    const searchResults = await searchForSignals(discoveryQuery, Math.min(perProviderLimit, 5));
    const signals: IncomingHiringSignal[] = [];

    for (const result of searchResults.slice(0, 2)) {
      const url = result.url.startsWith("http") ? result.url : `https://${result.url}`;

      try {
        const chain = await getProviderManager().executeCrawlChain(url);
        const html = chain.result.html.toLowerCase();
        const companyName = cleanCompanyTitle(result.title);
        const domain = extractDomain(url);

        const baseHint = {
          name: companyName,
          normalizedName: normalizeCompanyName(companyName),
          website: url,
          domain,
          city: criteria.city ?? null,
          region: criteria.region ?? null,
          sector: criteria.sector ?? null,
        };

        if (detectAtsFromHtml(chain.result.html)) {
          signals.push(
            enrichIncomingSignal(
              {
                type: "ats_detected",
                title: `ATS gedetecteerd — ${companyName}`,
                description: `Applicant tracking systeem gevonden op ${domain}`,
                url,
                source: "Firecrawl",
                provider: "firecrawl",
                confidence: getDefaultConfidence("ats_detected"),
                importance: 0,
                aiRelevance: 0,
                externalId: `firecrawl:ats:${domain}`,
                companyHint: baseHint,
                extractedFields: {
                  ...baseHint,
                  careers_url: url,
                  source: "Firecrawl",
                },
              },
              criteria,
            ),
          );
        }

        const careersKeyword = HIRING_PAGE_KEYWORDS.find((keyword) => html.includes(keyword));

        if (careersKeyword) {
          signals.push(
            enrichIncomingSignal(
              {
                type: "careers_page",
                title: `Werken-bij pagina — ${companyName}`,
                description: `Careers indicator "${careersKeyword}" op ${domain}`,
                url,
                source: "Firecrawl",
                provider: "firecrawl",
                confidence: getDefaultConfidence("careers_page"),
                importance: 0,
                aiRelevance: 0,
                externalId: `firecrawl:careers:${domain}`,
                companyHint: baseHint,
                extractedFields: {
                  ...baseHint,
                  careers_url: url,
                  vacancy_page_url: url,
                  source: "Firecrawl",
                },
              },
              criteria,
            ),
          );
        }

        signals.push(
          enrichIncomingSignal(
            {
              type: "website_change",
              title: `Website geanalyseerd — ${companyName}`,
              description: `Website crawl via ${chain.meta.providerId}`,
              url,
              source: "Firecrawl",
              provider: "firecrawl",
              confidence: getDefaultConfidence("website_change"),
              importance: 0,
              aiRelevance: 0,
              externalId: `firecrawl:site:${domain}`,
              companyHint: baseHint,
              extractedFields: { ...baseHint, source: "Firecrawl" },
              payload: { responseSize: chain.meta.responseSize },
            },
            criteria,
          ),
        );
      } catch {
        // crawl fallback chain exhausted — skip URL
      }
    }

    return signals;
  },
};
