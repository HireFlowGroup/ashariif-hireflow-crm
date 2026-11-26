/**
 * P0-R3.2.5 discovery smoke — max 2 HTTP calls, commercial employer query.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
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

const QUERY =
  "site:.nl (werken bij OR vacatures) (Recruiter OR Corporate Recruiter OR Talent Acquisition) (Rotterdam OR Den Haag OR Utrecht) -indeed -linkedin -monster -uitzendbureau -recruitment agency";

let httpCalls = 0;
const MAX_HTTP = 2;

import { isBlockedOfficialDomain, isVacancyBoardDomain } from "../src/features/company-finder/discovery/discovery-domain-blocklist";
import { isGenericCompanyLabel } from "../src/features/company-finder/discovery/generic-company-label";
import { classifySearchResult } from "../src/features/company-finder/discovery/result-classifier.service";

type Row = { title: string; url: string; snippet: string; provider: string };

async function serpSearch(): Promise<Row[]> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) return [];
  if (httpCalls >= MAX_HTTP) return [];
  httpCalls += 1;
  const params = new URLSearchParams({
    engine: "google",
    q: QUERY,
    api_key: key,
    num: "8",
    gl: "nl",
    hl: "nl",
  });
  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  const json = (await response.json()) as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (json.organic_results ?? [])
    .filter((r) => r.link && r.title)
    .map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      snippet: r.snippet ?? "",
      provider: "serpapi",
    }));
}

async function tavilySearch(): Promise<Row[]> {
  if (httpCalls >= MAX_HTTP) return [];
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];
  httpCalls += 1;
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: QUERY, max_results: 5, include_domains: [], exclude_domains: ["indeed.com", "linkedin.com"] }),
  });
  if (response.status === 432) return [];
  const json = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (json.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
    provider: "tavily",
  }));
}

const raw: Row[] = [...(await tavilySearch()), ...(await serpSearch())];

const evaluated = raw.map((row) => {
  const classified = classifySearchResult({ title: row.title, url: row.url, description: row.snippet });
  const blockedDomain = isBlockedOfficialDomain(row.url) || isVacancyBoardDomain(row.url);
  const genericTitle = isGenericCompanyLabel(row.title);
  return {
    title: row.title,
    url: row.url,
    provider: row.provider,
    shouldSaveAsCompany: classified.shouldSaveAsCompany,
    resultType: classified.resultType,
    blockedDomain,
    genericTitle,
    employerSignal: !blockedDomain && !genericTitle && (classified.resultType === "company" || classified.resultType === "company_careers_page"),
  };
});

const employerSignals = evaluated.filter((e) => e.employerSignal);

const out = {
  phase: "P0-R3.2.5-discovery-smoke",
  query: QUERY,
  httpCalls,
  rawCount: raw.length,
  employerSignalCount: employerSignals.length,
  sampleEmployerSignals: employerSignals.slice(0, 5),
  rejectedSamples: evaluated.filter((e) => !e.employerSignal).slice(0, 5),
  generatedAt: new Date().toISOString(),
};

writeFileSync(resolve(process.cwd(), "scripts/p0r325-discovery-smoke-output.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ httpCalls, rawCount: out.rawCount, employerSignalCount: out.employerSignalCount }, null, 2));