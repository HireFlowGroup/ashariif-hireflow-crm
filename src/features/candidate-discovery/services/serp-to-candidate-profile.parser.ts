import type {
  CandidateDiscoveryUnknownField,
  ParsedSerpProfile,
} from "@/features/candidate-discovery/domain/candidate-discovery.types";
import { normalizeLinkedInProfileUrl } from "@/features/candidate-discovery/services/linkedin-profile-url.validator";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";

const LINKEDIN_TITLE_SUFFIX = /\s*[\|–-]\s*linkedin.*$/i;
const TITLE_ROLE_SPLIT = /\s*[\|–-]\s*/;
const YEARS_IN_TEXT = /(\d+)\+?\s*(?:jaar|years)/i;
const ROLE_LIKE_WORDS =
  /^(senior|junior|medior|lead|head|chief|principal|staff|intern|freelance|software|frontend|backend|developer|engineer|manager|consultant|specialist|recruiter|hr)\b/i;

function looksLikePersonName(parts: string[]): boolean {
  if (parts.length < 2 || parts.length > 5) return false;
  if (ROLE_LIKE_WORDS.test(parts[0]!)) return false;
  return parts.every((part) => /^[\p{L}'-]+$/u.test(part));
}

function parseNameFromTitle(title: string): { firstName: string; lastName: string; unknown: boolean } {
  const cleaned = title.replace(LINKEDIN_TITLE_SUFFIX, "").trim();
  const segments = cleaned.split(TITLE_ROLE_SPLIT).map((s) => s.trim()).filter(Boolean);
  const namePart = segments[0] ?? cleaned;

  const parts = namePart.split(/\s+/).filter((p) => p.length > 0);
  if (looksLikePersonName(parts)) {
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(" "),
      unknown: false,
    };
  }

  return { firstName: "Onbekend", lastName: "Onbekend", unknown: true };
}

function parseRoleFromTitle(title: string): string | null {
  const cleaned = title.replace(LINKEDIN_TITLE_SUFFIX, "").trim();
  const segments = cleaned.split(TITLE_ROLE_SPLIT).map((s) => s.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const role = segments.slice(1).join(" - ").trim();
    return role.length >= 2 ? role.slice(0, 200) : null;
  }
  return null;
}

function literalSkillsFromSerp(
  serpText: string,
  vacancySkillTerms: string[],
): string[] {
  const lower = serpText.toLowerCase();
  const matched: string[] = [];
  for (const term of vacancySkillTerms) {
    const normalized = term.toLowerCase();
    if (normalized.length < 3) continue;
    if (lower.includes(normalized)) {
      matched.push(term);
    }
  }
  return [...new Set(matched)];
}

function literalLocationFromSerp(
  snippet: string,
  vacancyLocation: string | null,
): string | null {
  if (!vacancyLocation) return null;
  const loc = vacancyLocation.toLowerCase();
  if (snippet.toLowerCase().includes(loc)) {
    return vacancyLocation;
  }
  return null;
}

function parseExperienceYears(snippet: string): number | null {
  const match = snippet.match(YEARS_IN_TEXT);
  if (!match?.[1]) return null;
  const years = Number.parseInt(match[1], 10);
  return Number.isFinite(years) ? years : null;
}

export type ParseSerpProfileInput = {
  item: SearchResultItem;
  vacancySkillTerms: string[];
  vacancyLocation: string | null;
};

export function parseSerpToCandidateProfile(input: ParseSerpProfileInput): ParsedSerpProfile | null {
  const urlCheck = normalizeLinkedInProfileUrl(input.item.url);
  if (!urlCheck.ok) {
    return null;
  }

  const serpTitle = input.item.title?.trim() || "";
  const serpSnippet = input.item.description?.trim() || "";
  const serpBlob = `${serpTitle} ${serpSnippet}`.trim();

  const { firstName, lastName, unknown: nameUnknown } = parseNameFromTitle(serpTitle);
  const roleFromTitle = parseRoleFromTitle(serpTitle);
  const location = literalLocationFromSerp(serpBlob, input.vacancyLocation);
  const skills = literalSkillsFromSerp(serpBlob, input.vacancySkillTerms);
  const experienceYears = parseExperienceYears(serpSnippet);

  const unknownFields: CandidateDiscoveryUnknownField[] = [];
  if (nameUnknown) {
    unknownFields.push("firstName", "lastName");
  }
  if (!roleFromTitle) unknownFields.push("candidateCurrentRole");
  if (!location) unknownFields.push("location");
  if (!serpSnippet) unknownFields.push("summary");
  if (skills.length === 0) unknownFields.push("skills");
  if (experienceYears === null) unknownFields.push("experienceYears");
  unknownFields.push("salary", "email", "phone", "availability");

  return {
    linkedinUrl: urlCheck.value.normalizedUrl,
    firstName,
    lastName,
    candidateCurrentRole: roleFromTitle,
    location,
    summary: serpSnippet || null,
    skills,
    experienceYears,
    unknownFields: [...new Set(unknownFields)],
    serpTitle,
    serpSnippet,
    serpUrl: input.item.url,
  };
}