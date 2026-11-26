import "server-only";

import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import { getSerpApiKey, getTavilyApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import { isProviderQuotaExhausted } from "@/features/company-finder/discovery/provider-quota-registry.service";

export type DiscoverySearchReadiness = {
  canStart: boolean;
  degraded: boolean;
  message: string | null;
  primaryProvider: "tavily" | "serpapi" | null;
};

export function resolveDiscoverySearchReadiness(): DiscoverySearchReadiness {
  const config = getAiRecruiterConfig();
  const hasTavilyKey = Boolean(getTavilyApiKey());
  const hasSerpKey = Boolean(getSerpApiKey());
  const tavilyQuotaExhausted = isProviderQuotaExhausted("tavily");
  const tavilyHttpBudgetDisabled = config.discoveryMaxHttpAttemptsTavily <= 0;

  if (hasTavilyKey && !tavilyQuotaExhausted && !tavilyHttpBudgetDisabled) {
    return {
      canStart: true,
      degraded: false,
      message: null,
      primaryProvider: "tavily",
    };
  }

  if (hasSerpKey) {
    return {
      canStart: true,
      degraded: true,
      message: tavilyQuotaExhausted
        ? "Tavily-quota uitgeput — discovery in degraded mode via SerpAPI."
        : tavilyHttpBudgetDisabled
          ? "Tavily HTTP-budget uit (0) — discovery via SerpAPI."
          : "Tavily niet beschikbaar — discovery via SerpAPI.",
      primaryProvider: "serpapi",
    };
  }

  if (!hasTavilyKey && !hasSerpKey) {
    return {
      canStart: false,
      degraded: false,
      message: "Geen discovery search provider geconfigureerd (Tavily/SerpAPI).",
      primaryProvider: null,
    };
  }

  return {
    canStart: false,
    degraded: true,
    message: "Tavily-quota uitgeput en SerpAPI niet beschikbaar.",
    primaryProvider: null,
  };
}