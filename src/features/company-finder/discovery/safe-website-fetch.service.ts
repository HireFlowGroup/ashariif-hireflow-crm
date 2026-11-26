import "server-only";

import { getLeadIntelligenceConfig } from "@/features/lead-intelligence/config/providers.config";

export type SafeWebsiteFetchErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "private_network"
  | "too_many_redirects"
  | "non_html"
  | "response_too_large"
  | "http_error"
  | "timeout"
  | "fetch_failed";

export type SafeWebsiteFetchResult =
  | { ok: true; url: string; text: string; redirectsFollowed: number }
  | { ok: false; code: SafeWebsiteFetchErrorCode; message: string };

const DEFAULT_MAX_BYTES = 350_000;
const DEFAULT_MAX_REDIRECTS = 4;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".corp", ".lan"];

function isIpv4(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4(hostname)) return false;
  const parts = hostname.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host === "0.0.0.0" || host === "::1" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (isPrivateIpv4(host)) return true;
  return false;
}

export function assertSafeWebsiteUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; code: SafeWebsiteFetchErrorCode; message: string } {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid_url", message: "Lege URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, code: "invalid_url", message: "Ongeldige URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: "invalid_url", message: "Alleen http(s) toegestaan" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, code: "invalid_url", message: "URL met credentials niet toegestaan" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    return { ok: false, code: "blocked_host", message: `Geblokkeerde host: ${hostname}` };
  }

  return { ok: true, url: parsed };
}

async function readResponseTextLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function safeFetchWebsiteText(
  rawUrl: string,
  options?: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number },
): Promise<SafeWebsiteFetchResult> {
  const config = getLeadIntelligenceConfig();
  const timeoutMs = options?.timeoutMs ?? config.crawlerTimeoutMs;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let current = assertSafeWebsiteUrl(rawUrl);
  if (!current.ok) return current;

  let redirectsFollowed = 0;

  while (true) {
    try {
      const response = await fetch(current.url.toString(), {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "HireFlow-CompanyFinder/2.0 (bounded enrichment)",
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, code: "http_error", message: `Redirect zonder Location (${response.status})` };
        }
        if (redirectsFollowed >= maxRedirects) {
          return { ok: false, code: "too_many_redirects", message: "Te veel redirects" };
        }
        redirectsFollowed += 1;
        const next = assertSafeWebsiteUrl(new URL(location, current.url).toString());
        if (!next.ok) return next;
        current = next;
        continue;
      }

      if (!response.ok) {
        return { ok: false, code: "http_error", message: `HTTP ${response.status}` };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return { ok: false, code: "non_html", message: "Geen HTML-response" };
      }

      const text = await readResponseTextLimited(response, maxBytes);
      return { ok: true, url: current.url.toString(), text, redirectsFollowed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "RESPONSE_TOO_LARGE") {
        return { ok: false, code: "response_too_large", message: "Response te groot" };
      }
      if (/timeout|aborted|abort/i.test(message)) {
        return { ok: false, code: "timeout", message: "Timeout bij website-fetch" };
      }
      return { ok: false, code: "fetch_failed", message: message.slice(0, 200) };
    }
  }
}

/** Convenience wrapper for enrichment steps — returns null on any failure. */
export async function safeReadWebsiteTextOrNull(
  rawUrl: string,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<string | null> {
  const result = await safeFetchWebsiteText(rawUrl, options);
  return result.ok ? result.text : null;
}