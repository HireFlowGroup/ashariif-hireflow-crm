/**
 * P0-R3.2.3 — provider smoke (max 2 HTTP calls). No secrets logged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const SMOKE_QUERY = "recruiter vacature Rotterdam";
let httpCalls = 0;
const MAX_HTTP = 2;

type SmokeRow = {
  provider: "tavily" | "serpapi";
  httpStatus: number | null;
  ok: boolean;
  quotaExceeded: boolean;
  resultCount: number;
  errorPreview: string | null;
};

async function smokeTavily(): Promise<SmokeRow> {
  if (httpCalls >= MAX_HTTP) {
    return {
      provider: "tavily",
      httpStatus: null,
      ok: false,
      quotaExceeded: false,
      resultCount: 0,
      errorPreview: "skipped_http_budget",
    };
  }
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) {
    return {
      provider: "tavily",
      httpStatus: null,
      ok: false,
      quotaExceeded: false,
      resultCount: 0,
      errorPreview: "not_configured",
    };
  }
  httpCalls += 1;
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: SMOKE_QUERY, max_results: 1 }),
  });
  const body = await response.text();
  const quotaExceeded = response.status === 432 || /usage limit|quota/i.test(body);
  let resultCount = 0;
  try {
    const json = JSON.parse(body) as { results?: unknown[] };
    resultCount = Array.isArray(json.results) ? json.results.length : 0;
  } catch {
    /* non-json */
  }
  return {
    provider: "tavily",
    httpStatus: response.status,
    ok: response.ok && resultCount > 0,
    quotaExceeded,
    resultCount,
    errorPreview: response.ok ? null : body.slice(0, 120).replace(/\s+/g, " "),
  };
}

async function smokeSerpApi(): Promise<SmokeRow> {
  if (httpCalls >= MAX_HTTP) {
    return {
      provider: "serpapi",
      httpStatus: null,
      ok: false,
      quotaExceeded: false,
      resultCount: 0,
      errorPreview: "skipped_http_budget",
    };
  }
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) {
    return {
      provider: "serpapi",
      httpStatus: null,
      ok: false,
      quotaExceeded: false,
      resultCount: 0,
      errorPreview: "not_configured",
    };
  }
  httpCalls += 1;
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", SMOKE_QUERY);
  url.searchParams.set("num", "3");
  url.searchParams.set("api_key", key);
  const response = await fetch(url);
  const body = await response.text();
  let resultCount = 0;
  try {
    const json = JSON.parse(body) as { organic_results?: unknown[] };
    resultCount = Array.isArray(json.organic_results) ? json.organic_results.length : 0;
  } catch {
    /* non-json */
  }
  return {
    provider: "serpapi",
    httpStatus: response.status,
    ok: response.ok && resultCount > 0,
    quotaExceeded: false,
    resultCount,
    errorPreview: response.ok ? null : body.slice(0, 120).replace(/\s+/g, " "),
  };
}

const tavily = await smokeTavily();
const serpapi =
  tavily.ok && !tavily.quotaExceeded
    ? {
        provider: "serpapi" as const,
        httpStatus: null,
        ok: false,
        quotaExceeded: false,
        resultCount: 0,
        errorPreview: "skipped_tavily_healthy",
      }
    : await smokeSerpApi();

const primaryProvider =
  tavily.ok && !tavily.quotaExceeded
    ? "tavily"
    : serpapi.ok
      ? "serpapi"
      : tavily.quotaExceeded && serpapi.ok
        ? "serpapi"
        : null;

const canStart = Boolean(primaryProvider);

console.log(
  JSON.stringify(
    {
      phase: "C-provider-smoke",
      supabaseProjectRef: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("vcmegbghsaqagikfxces")
        ? "vcmegbghsaqagikfxces"
        : "UNKNOWN",
      configured: {
        tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
        serpapi: Boolean(process.env.SERPAPI_API_KEY?.trim()),
        openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
      },
      httpCallsUsed: httpCalls,
      maxHttpCalls: MAX_HTTP,
      providers: [tavily, serpapi],
      primaryProvider,
      degraded: tavily.quotaExceeded || (!tavily.ok && serpapi.ok),
      canStartDiscovery: canStart,
    },
    null,
    2,
  ),
);

if (!canStart) process.exit(3);