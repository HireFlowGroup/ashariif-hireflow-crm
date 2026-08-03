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
  address: false,
};

export async function fetchHomepageSignals(
  url: string,
  timeoutMs: number,
): Promise<HomepageSignalResult> {
  try {
    const html = await fetchHomepageHtml(url, timeoutMs);
    const signals = detectHomepageSignals(html);
    const signalCount = countHomepageSignals(signals);

    return { signals, signalCount, htmlFetched: true };
  } catch {
    return { signals: { ...EMPTY_SIGNALS }, signalCount: 0, htmlFetched: false };
  }
}

async function fetchHomepageHtml(url: string, timeoutMs: number): Promise<string> {
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
    overOns: /over ons|about us|who we are|onze organisatie|onze missie/i.test(lower),
    contact: /contact|neem contact|contacteer ons|get in touch/i.test(lower),
    vacatures: /vacatures|werken bij|careers|jobs|openstaande functies|join our team/i.test(lower),
    linkedin: /linkedin\.com\/company\//i.test(html),
    privacy: /privacy|privacyverklaring|privacy policy/i.test(lower),
    cookies: /cookie|cookieverklaring|cookie policy/i.test(lower),
    phone: /(?:\+31|0031|\b0)[\s-]?(?:\d[\s-]?){8,12}/.test(html),
    address: /\b\d{4}\s?[a-z]{2}\b/i.test(html) || /straat|weg|laan|plein|singel|kade|boulevard/i.test(lower),
  };
}

export function countHomepageSignals(signals: HomepageSignals): number {
  return Object.values(signals).filter(Boolean).length;
}

export function formatHomepageSignals(signals: HomepageSignals): string {
  return Object.entries(signals)
    .filter(([, present]) => present)
    .map(([key]) => key)
    .join(", ");
}
