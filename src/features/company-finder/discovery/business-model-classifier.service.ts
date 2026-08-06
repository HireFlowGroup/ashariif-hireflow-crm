import { detectRecruitmentCompetitor } from "@/features/company-finder/discovery/competitor-detection.service";

export type BusinessModelClassification =
  | "potential_client"
  | "recruitment_competitor"
  | "staffing_competitor"
  | "job_board"
  | "consultancy"
  | "unknown";

export type BusinessModelResult = {
  classification: BusinessModelClassification;
  confidence: number;
  reasons: string[];
  evidence: Array<{ type: string; value: string }>;
};

const STAFFING_PATTERNS = [
  /\b(it\s+staffing|it-staffing)\b/i,
  /\bdetach(eer|ering|erings|eringsbureau)\b/i,
  /\bsecondment\b/i,
  /\buitzend(bureau|organisatie)?\b/i,
  /\bpersoneels(bemiddeling|dienst|verlening)\b/i,
  /\baxs\s*ict\b/i,
  /\baxsict\b/i,
  /\btech\s+talent\b/i,
  /\bIT\s+professionals?\s+voor\b/i,
  /\bmedewerkers?\s+(detacheren|uitlenen)\b/i,
  /\bstaffing\s+(agency|company|firm)\b/i,
  /\bwerving\s*[&en]+\s*selectie\b/i,
  /\bexecutive\s+search\b/i,
  /\btalent\s+sourcing\b/i,
  /\brecruitment\s+consultancy\b/i,
  /\brecruitment\s+partner\b/i,
  /\brecruitment\s+bureau\b/i,
];

const RECRUITMENT_PATTERNS = [
  /\brecruitment\s+(agency|agencies|specialist|specialists|bureau|bureaus)\b/i,
  /\brecruitment\s+specialists?\b/i,
  /\bwerving\s+en\s+selectie\b/i,
  /\bheadhunt(er|ing|ers)?\b/i,
  /\bRobert\s+Half\b/i,
  /\bHays\b/i,
  /\bMichael\s+Page\b/i,
];

const CONSULTANCY_PATTERNS = [
  /\bmanagement\s+consulting\b/i,
  /\bstrategy\s+consultancy\b/i,
  /\badvisory\s+services\b/i,
];

const JOB_BOARD_PATTERNS = [
  /\bjob\s+board\b/i,
  /\bvacaturebank\b/i,
  /\bvacatureplatform\b/i,
];

function collectMatches(text: string, patterns: RegExp[], type: string): Array<{ type: string; value: string }> {
  const evidence: Array<{ type: string; value: string }> = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) evidence.push({ type, value: match[0] });
  }
  return evidence;
}

export function classifyBusinessModel(input: {
  name?: string | null;
  url?: string | null;
  description?: string | null;
  sector?: string | null;
  html?: string | null;
  excludeRecruitmentAgencies?: boolean;
}): BusinessModelResult {
  const text = [input.name, input.description, input.url, input.sector, input.html?.slice(0, 5000)]
    .filter(Boolean)
    .join(" ");

  const evidence: Array<{ type: string; value: string }> = [];

  if (JOB_BOARD_PATTERNS.some((p) => p.test(text))) {
    return {
      classification: "job_board",
      confidence: 0.9,
      reasons: ["Vacatureplatform of job board gedetecteerd"],
      evidence: collectMatches(text, JOB_BOARD_PATTERNS, "job_board"),
    };
  }

  const staffingEvidence = collectMatches(text, STAFFING_PATTERNS, "staffing_signal");
  if (staffingEvidence.length > 0) {
    return {
      classification: "staffing_competitor",
      confidence: Math.min(0.96, 0.75 + staffingEvidence.length * 0.08),
      reasons: ["IT-staffing, detachering of personeelsbemiddeling gedetecteerd"],
      evidence: staffingEvidence,
    };
  }

  const recruitmentEvidence = collectMatches(text, RECRUITMENT_PATTERNS, "recruitment_signal");
  const legacy = detectRecruitmentCompetitor({
    title: input.name ?? "",
    url: input.url ?? undefined,
    description: input.description,
    excludeRecruitmentAgencies: input.excludeRecruitmentAgencies ?? true,
  });

  if (recruitmentEvidence.length > 0 || legacy.isCompetitor) {
    return {
      classification: "recruitment_competitor",
      confidence: legacy.isCompetitor ? legacy.confidence : 0.85,
      reasons: [legacy.reason || "Recruitmentbureau of werving & selectie gedetecteerd"],
      evidence: recruitmentEvidence,
    };
  }

  if (CONSULTANCY_PATTERNS.some((p) => p.test(text))) {
    return {
      classification: "consultancy",
      confidence: 0.7,
      reasons: ["Consultancy/advisory — geen primaire opdrachtgever"],
      evidence: collectMatches(text, CONSULTANCY_PATTERNS, "consultancy"),
    };
  }

  return {
    classification: "potential_client",
    confidence: 0.6,
    reasons: ["Geen concurrent-signaal — potentiële opdrachtgever"],
    evidence,
  };
}

export function isExcludedBusinessModel(
  classification: BusinessModelClassification,
  excludeRecruitmentAgencies = true,
): boolean {
  if (!excludeRecruitmentAgencies) return false;
  return classification === "recruitment_competitor" || classification === "staffing_competitor";
}
