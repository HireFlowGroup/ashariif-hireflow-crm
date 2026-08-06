export type IdentityEvidence = {
  type: string;
  value: string;
  url?: string;
  weight: number;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function cleanName(value: string): string | null {
  const cleaned = decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/\s*[|\-–—]\s*.+$/, "")
    .replace(/\s+(home|homepage|official site|vacatures|werken bij).*$/i, "")
    .trim();

  if (!cleaned || cleaned.length < 2 || cleaned.length > 120) return null;
  return cleaned;
}

export function extractSchemaOrgOrganizationName(html: string): string | null {
  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of jsonLdBlocks) {
    const payload = block.replace(/<\/?script[^>]*>/gi, "").trim();
    try {
      const parsed = JSON.parse(payload) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const name = findOrganizationName(node);
        if (name) return name;
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }

  const inlineMatch = html.match(/"(@type|type)"\s*:\s*"Organization"[\s\S]{0,400}?"name"\s*:\s*"([^"]+)"/i);
  if (inlineMatch?.[2]) return cleanName(inlineMatch[2]);

  return null;
}

function findOrganizationName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const typeValue = record["@type"] ?? record.type;
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  if (types.some((type) => typeof type === "string" && /organization|localbusiness|corporation/i.test(type))) {
    if (typeof record.name === "string") return cleanName(record.name);
  }
  if (record["@graph"] && Array.isArray(record["@graph"])) {
    for (const child of record["@graph"]) {
      const nested = findOrganizationName(child);
      if (nested) return nested;
    }
  }
  return null;
}

export function extractOpenGraphSiteName(html: string): string | null {
  const match =
    html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  return match?.[1] ? cleanName(match[1]) : null;
}

export function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanName(match[1]) : null;
}

export function extractLegalNameFromLegalPages(html: string): string | null {
  const patterns = [
    /(?:bedrijfsnaam|handelsnaam|legal entity|company name)\s*[:\-]\s*([A-Z0-9][A-Za-z0-9&.\- ]{2,80})/i,
    /(?:gevestigd te|opgericht door|uitgegeven door)\s+([A-Z0-9][A-Za-z0-9&.\- ]{2,80})/i,
    /\b([A-Z0-9][A-Za-z0-9&.\- ]{2,60})\s+B\.?V\.?\b/,
    /\b([A-Z0-9][A-Za-z0-9&.\- ]{2,60})\s+N\.?V\.?\b/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanName(match[1]);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

export function extractFooterCompanyName(html: string): string | null {
  const footerMatch = html.match(/<footer[\s\S]{0,8000}?<\/footer>/i);
  if (!footerMatch) return null;

  const copyrightMatch = footerMatch[0].match(/©\s*\d{4}\s*([A-Z0-9][A-Za-z0-9&.\- ]{2,60})/i);
  return copyrightMatch?.[1] ? cleanName(copyrightMatch[1]) : null;
}

export function domainStemToBrandName(domain: string): string | null {
  const stem = domain.replace(/^www\./, "").split(".")[0] ?? "";
  if (!stem || stem.length < 3) return null;
  if (/^\d+$/.test(stem)) return null;

  const spaced = stem
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return cleanName(spaced);
}
