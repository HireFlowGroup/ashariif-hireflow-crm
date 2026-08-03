import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { extractDomain, normalizeCompanyName } from "@/features/lead-intelligence/services/normalize";

export function cleanCompanyTitle(title: string): string {
  return title
    .replace(/\s*[|\-–—].*$/, "")
    .replace(/\s*(home|homepage|official site|vacatures|werken bij).*$/i, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
}

export { extractDomain, normalizeCompanyName };

export function extractEmailsFromText(text: string): string[] {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex) ?? [];
  return [...new Set(matches.map((email) => email.toLowerCase()))];
}

export function extractPhonesFromText(text: string): string[] {
  const regex = /(?:\+31|0)[\s-]?(?:\d[\s-]?){8,}/g;
  const matches = text.match(regex) ?? [];
  return [...new Set(matches.map((phone) => phone.trim()))];
}

export function extractKvkFromText(text: string): string | null {
  const kvkMatch = text.match(/\b(?:KvK|KVK|kamer van koophandel)[:\s#-]*(\d{8})\b/i);
  if (kvkMatch?.[1]) return kvkMatch[1];

  const standalone = text.match(/\b(\d{8})\b/);
  return standalone?.[1] ?? null;
}

export function classifyHrEmail(emails: string[]): string | null {
  const hrPatterns = [/^(hr|recruitment|recruit|werkenbij|careers|jobs|vacature|sollicit)/i];
  return emails.find((email) => hrPatterns.some((pattern) => pattern.test(email.split("@")[0] ?? ""))) ?? null;
}

export function classifyGeneralEmail(emails: string[]): string | null {
  const generalPatterns = [/^(info|contact|hello|mail|office|admin)/i];
  return emails.find((email) => generalPatterns.some((pattern) => pattern.test(email.split("@")[0] ?? ""))) ?? null;
}

export function findCareersUrl(html: string, baseUrl: string): string | null {
  const patterns = [
    /href=["']([^"']*(?:werken-bij|werkenbij|vacatures|careers|jobs|join-us)[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        continue;
      }
    }
  }

  return null;
}

export function mergeEnrichment(
  candidate: ExternalCompanyCandidate,
  patch: Partial<ExternalCompanyCandidate>,
): ExternalCompanyCandidate {
  return {
    ...candidate,
    ...patch,
    email: patch.generalEmail ?? patch.email ?? candidate.email,
    hiringSignals: patch.hiringSignals ?? candidate.hiringSignals,
    vacancyTitles: patch.vacancyTitles ?? candidate.vacancyTitles,
  };
}
