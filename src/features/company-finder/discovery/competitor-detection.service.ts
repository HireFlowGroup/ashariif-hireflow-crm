/** Detect recruitment/staffing agencies that should be excluded as competitors. */

const COMPETITOR_PATTERNS = [
  /\brecruitment\s+(agency|agencies|specialist|specialists|bureau|bureaus)\b/i,
  /\buitzend(bureau|bureaus|organisatie)?\b/i,
  /\bdetach(eer|ering|erings)?\b/i,
  /\bstaffing\s+(agency|agencies|firm|company)\b/i,
  /\bwerving\s*[&en]+\s*selectie\b/i,
  /\bexecutive\s+search\b/i,
  /\bheadhunt(er|ing|ers)?\b/i,
  /\bpersoneels(dienst|bureau|verlening)\b/i,
  /\brecruitment\s+consultant\b/i,
  /\brecruitment\s+specialists?\b/i,
  /\bspecialists?\s+(in|voor)\s+(the\s+)?netherlands\b/i,
  /\bspecialists?\s+in\b/i,
  /\brecruitment\s+in\s+nederland\b/i,
  /\bRobert\s+Half\b/i,
  /\bRandstad\b/i,
  /\bAdecco\b/i,
  /\bManpower\b/i,
  /\bYacht\b/i,
  /\bBrunel\b/i,
  /\bHays\b/i,
  /\bMichael\s+Page\b/i,
  /\bPageGroup\b/i,
  /\bTempo-Team\b/i,
  /\bUnique\b.*\buitzend/i,
];

const COMPETITOR_URL_SEGMENTS = [
  "/recruitment-agency",
  "/uitzendbureau",
  "/staffing",
  "/werving-selectie",
  "/detachering",
];

export type CompetitorCheckResult = {
  isCompetitor: boolean;
  confidence: number;
  reason: string;
};

export function detectRecruitmentCompetitor(input: {
  title: string;
  url?: string;
  description?: string | null;
  excludeRecruitmentAgencies?: boolean;
}): CompetitorCheckResult {
  if (input.excludeRecruitmentAgencies === false) {
    return { isCompetitor: false, confidence: 0, reason: "Concurrenten niet uitgesloten" };
  }

  const text = [input.title, input.description ?? "", input.url ?? ""].join(" ");

  for (const pattern of COMPETITOR_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isCompetitor: true,
        confidence: 0.92,
        reason: `Recruitment/uitzend-signaal: ${pattern.source}`,
      };
    }
  }

  const url = (input.url ?? "").toLowerCase();
  if (COMPETITOR_URL_SEGMENTS.some((seg) => url.includes(seg))) {
    return {
      isCompetitor: true,
      confidence: 0.88,
      reason: "URL wijst op recruitment/uitzenddienst",
    };
  }

  return { isCompetitor: false, confidence: 0.5, reason: "Geen concurrent-signaal" };
}
