import type { HomepageSignalResult, HomepageSignals } from "@/features/company-finder/discovery/discovery-quality.types";

const EMPTY_SIGNALS: HomepageSignals = {
  kvk: false,
  btw: false,
  overOns: false,
  contact: false,
  vacatures: false,
  linkedin: false,
  privacy: false,
  cookies: false,
  phone: false,
  email: false,
  address: false,
};

/** Signals that qualify a page as a bedrijfswebsite (min. één vereist, tenzij AI >70). */
export const COMPANY_ACCEPTANCE_SIGNAL_KEYS = [
  "contact",
  "phone",
  "email",
  "linkedin",
  "address",
  "kvk",
  "overOns",
] as const satisfies ReadonlyArray<keyof HomepageSignals>;

export type CompanyAcceptanceSignalKey = (typeof COMPANY_ACCEPTANCE_SIGNAL_KEYS)[number];

export async function fetchHomepageSignals(
  url: string,
  timeoutMs: number,
): Promise<HomepageSignalResult> {
  try {
    const html = await fetchHomepageHtml(url, timeoutMs);
    const signals = detectHomepageSignals(html);
    const signalCount = countHomepageSignals(signals);
    const companySignalCount = countCompanyAcceptanceSignals(signals);

    return {
      signals,
      signalCount,
      companySignalCount,
      hasCompanyAcceptanceSignal: companySignalCount >= 1,
      htmlFetched: true,
      html: html.slice(0, 300_000),
    };
  } catch {
    return {
      signals: { ...EMPTY_SIGNALS },
      signalCount: 0,
      companySignalCount: 0,
      hasCompanyAcceptanceSignal: false,
      htmlFetched: false,
    };
  }
}

export async function fetchHomepageHtml(url: string, timeoutMs: number): Promise<string> {
  const normalized = url.startsWith("http") ? url : `https://${url}`;

  const response = await fetch(normalized, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "HireFlow-CompanyFinder/2.0 (business discovery)",
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Homepage status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("Geen HTML homepage");
  }

  const text = await response.text();
  return text.slice(0, 300_000);
}

export function detectHomepageSignals(html: string): HomepageSignals {
  const lower = html.toLowerCase();

  return {
    kvk: /kvk|kamer van koophandel|\bk\d{8}\b/i.test(html),
    btw: /\bbtw\b|vat nummer|btw-nummer|btw nummer/i.test(html),
    overOns: /over ons|about us|who we are|onze organisatie|onze missie|\/over-ons|\/about/i.test(lower),
    contact: /contact|neem contact|contacteer ons|get in touch|\/contact/i.test(lower),
    vacatures: /vacatures|werken bij|careers|jobs|openstaande functies|join our team/i.test(lower),
    linkedin: /linkedin\.com\/company\//i.test(html),
    privacy: /privacy|privacyverklaring|privacy policy/i.test(lower),
    cookies: /cookie|cookieverklaring|cookie policy/i.test(lower),
    phone: /(?:\+31|0031|\b0)[\s-]?(?:\d[\s-]?){8,12}/.test(html),
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(html)
      && !/example\.com|sentry\.|wixpress|schema\.org/i.test(html),
    address: /\b\d{4}\s?[a-z]{2}\b/i.test(html) || /straat|weg|laan|plein|singel|kade|boulevard/i.test(lower),
  };
}

export function countHomepageSignals(signals: HomepageSignals): number {
  return Object.values(signals).filter(Boolean).length;
}

export function countCompanyAcceptanceSignals(signals: HomepageSignals): number {
  return COMPANY_ACCEPTANCE_SIGNAL_KEYS.filter((key) => signals[key]).length;
}

export function hasCompanyAcceptanceSignal(signals: HomepageSignals): boolean {
  return countCompanyAcceptanceSignals(signals) >= 1;
}

export function formatHomepageSignals(signals: HomepageSignals): string {
  return Object.entries(signals)
    .filter(([, present]) => present)
    .map(([key]) => key)
    .join(", ");
}

export function formatCompanyAcceptanceSignals(signals: HomepageSignals): string {
  return COMPANY_ACCEPTANCE_SIGNAL_KEYS.filter((key) => signals[key]).join(", ");
}
