import type { ValidatedLinkedInProfileUrl } from "@/features/candidate-discovery/domain/candidate-discovery.types";

const PROFILE_PATH = /^\/in\/([a-zA-Z0-9\-_%]+)\/?$/i;

const REJECTED_PATH_PREFIXES = [
  "/company/",
  "/jobs/",
  "/pub/",
  "/school/",
  "/groups/",
  "/feed/",
  "/search/",
  "/in/UNAVAILABLE",
];

export type LinkedInUrlValidationResult =
  | { ok: true; value: ValidatedLinkedInProfileUrl }
  | { ok: false; reason: string };

export function normalizeLinkedInProfileUrl(rawUrl: string): LinkedInUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, reason: "Lege URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "Ongeldige URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Alleen http(s)-URL's toegestaan" };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "linkedin.com") {
    return { ok: false, reason: "Geen linkedin.com-host" };
  }

  const path = parsed.pathname;
  if (REJECTED_PATH_PREFIXES.some((prefix) => path.toLowerCase().startsWith(prefix))) {
    return { ok: false, reason: "Geen persoonsprofiel-pad" };
  }

  const match = path.match(PROFILE_PATH);
  if (!match?.[1]) {
    return { ok: false, reason: "Verwacht pad /in/{slug}" };
  }

  const slug = decodeURIComponent(match[1]);
  if (slug.length < 2) {
    return { ok: false, reason: "Profielslug te kort" };
  }

  parsed.search = "";
  parsed.hash = "";
  const normalizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, "")}`;

  return {
    ok: true,
    value: {
      normalizedUrl,
      profileSlug: slug,
    },
  };
}

export function isLinkedInProfileUrl(url: string): boolean {
  return normalizeLinkedInProfileUrl(url).ok;
}