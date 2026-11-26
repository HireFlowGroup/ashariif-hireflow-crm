import "server-only";

import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import type { TavilyDiscoveryResult } from "@/features/company-finder/discovery/discovery-quality-gate";
import { hasConcreteJobUrl } from "@/features/ai-recruiter/services/vacancy-url.validation";
import { sanitizeDiscoveryUrl } from "@/lib/company-finder/sanitize-discovery-url";

/** Discovery vacature-URL en titel op kandidaat (CRM + qualification). */
export function applyDiscoveryVacancyEvidenceToCandidate(
  candidate: ExternalCompanyCandidate,
  result: Pick<
    TavilyDiscoveryResult,
  "discoveryVacancyUrl" | "discoveryVacancyTitle" | "discoveryVacancySource"
  >,
  provider: string,
): ExternalCompanyCandidate {
  const rawUrl = result.discoveryVacancyUrl ?? candidate.vacancyPageUrl;
  const vacancyPageUrl = sanitizeDiscoveryUrl(
    rawUrl && hasConcreteJobUrl(rawUrl) ? rawUrl : null,
  );

  const discoveryTitle = result.discoveryVacancyTitle?.trim() || null;
  const vacancyTitles = [
    ...new Set(
      [...(candidate.vacancyTitles ?? []), ...(discoveryTitle ? [discoveryTitle] : [])].filter(Boolean),
    ),
  ];

  const hiringSignals = [...(candidate.hiringSignals ?? [])];
  if (vacancyPageUrl && discoveryTitle) {
    const exists = hiringSignals.some(
      (signal) => signal.type === "active_vacancy" && signal.description === discoveryTitle,
    );
    if (!exists) {
      hiringSignals.push({
        type: "active_vacancy",
        description: discoveryTitle,
        source: result.discoveryVacancySource ?? provider,
        confidence: 0.85,
      });
    }
  }

  const vacancyCount = vacancyPageUrl
    ? Math.max(candidate.vacancyCount ?? 0, vacancyTitles.length || 1)
    : candidate.vacancyCount ?? 0;

  return {
    ...candidate,
    vacancyPageUrl,
    vacancyTitles,
    vacancyCount,
    hiringSignals,
  };
}