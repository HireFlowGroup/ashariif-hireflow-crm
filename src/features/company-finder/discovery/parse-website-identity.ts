/** Parse organization identity signals from homepage HTML (no network). */

export function extractSchemaOrgOrganizationName(html: string): string | null {
  const patterns = [
    /"@type"\s*:\s*"Organization"[^}]*"name"\s*:\s*"([^"]+)"/i,
    /"@type"\s*:\s*"LocalBusiness"[^}]*"name"\s*:\s*"([^"]+)"/i,
    /itemtype="[^"]*Organization[^"]*"[^>]*>[\s\S]{0,500}?itemprop="name"[^>]*>([^<]+)</i,
    /property="og:site_name"\s+content="([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = decodeHtmlEntities(match[1].trim());
      if (value.length >= 2 && value.length <= 120) return value;
    }
  }

  const ogMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (ogMatch?.[1]) {
    const value = decodeHtmlEntities(ogMatch[1].trim());
    if (value.length >= 2 && value.length <= 120) return value;
  }

  return null;
}

export function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match?.[1]) return null;
  const title = decodeHtmlEntities(match[1].trim());
  return title.split(/\s*[|\-–—]\s*/)[0]?.trim() || title;
}

export function extractLegalNameFromLegalPages(html: string): string | null {
  const patterns = [
    /(?:bedrijfsnaam|handelsnaam|legal entity|company name)[:\s]+([A-Z0-9][A-Za-z0-9&.\- ]{2,80}(?:B\.V\.|BV|N\.V\.|NV|V\.O\.F\.|VOF)?)/i,
    /(?:gevestigd te|opereert onder de naam)\s+([A-Z0-9][A-Za-z0-9&.\- ]{2,80})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

export function extractFooterBrandName(html: string): string | null {
  const footerMatch = html.match(/<footer[\s\S]{0,8000}?<\/footer>/i);
  const scope = footerMatch?.[0] ?? html.slice(-12000);
  const copyright = scope.match(/©\s*\d{4}\s+([A-Z0-9][A-Za-z0-9&.\- ]{2,60})/);
  if (copyright?.[1]) return decodeHtmlEntities(copyright[1].trim());
  return null;
}

export function brandNameFromDomain(domain: string | null): string | null {
  if (!domain) return null;
  const stem = domain.replace(/^www\./, "").split(".")[0] ?? "";
  if (!stem || stem.length < 2) return null;
  if (/^\d+$/.test(stem)) return null;
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
