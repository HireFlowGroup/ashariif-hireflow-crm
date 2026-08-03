import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import type { ManagedProviderDefinition } from "@/features/lead-intelligence/providers/manager/types";
import {
  getBingSearchApiKey,
  getBraveSearchApiKey,
  getGoogleCseConfig,
  getSerpApiKey,
  getTavilyApiKey,
  parseQuotaFromHeaders,
} from "@/features/lead-intelligence/providers/manager/provider-env";
import type { SearchResultItem } from "@/features/lead-intelligence/providers/manager/types";

export async function executeTavilySearch(
  query: string,
  maxResults: number,
): Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) throw new Error("Tavily API key ontbreekt");

  const timeoutMs = parseInt(process.env.COMPANY_FINDER_TAVILY_TIMEOUT_MS ?? "10000", 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        query,
        max_results: Math.min(maxResults, 20),
        search_depth: "basic",
      }),
    });

    const body = await response.text();
    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${body.slice(0, 200)}`);

    const payload = JSON.parse(body) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const data = (payload.results ?? [])
      .filter((row) => row.title && row.url)
      .map((row) => ({
        title: row.title!.trim(),
        url: row.url!.trim(),
        description: row.content?.trim() ?? "",
      }));

    return { data, responseSize: body.length, quotaRemaining: parseQuotaFromHeaders(response.headers) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Tavily time-out na ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeBraveSearch(
  query: string,
  maxResults: number,
): Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }> {
  const apiKey = getBraveSearchApiKey();
  if (!apiKey) throw new Error("Brave Search API key ontbreekt");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(maxResults, 20)));
  url.searchParams.set("country", "NL");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Brave Search HTTP ${response.status}: ${body.slice(0, 200)}`);

  const payload = JSON.parse(body) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  const data = (payload.web?.results ?? [])
    .filter((row) => row.title && row.url)
    .map((row) => ({
      title: row.title!.trim(),
      url: row.url!.trim(),
      description: row.description?.trim() ?? "",
    }));

  return { data, responseSize: body.length, quotaRemaining: parseQuotaFromHeaders(response.headers) };
}

export async function executeSerpApiSearch(
  query: string,
  maxResults: number,
): Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }> {
  const apiKey = getSerpApiKey();
  if (!apiKey) throw new Error("SerpAPI key ontbreekt");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(maxResults, 20)));
  url.searchParams.set("gl", "nl");
  url.searchParams.set("hl", "nl");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString());
  const body = await response.text();
  if (!response.ok) throw new Error(`SerpAPI HTTP ${response.status}: ${body.slice(0, 200)}`);

  const payload = JSON.parse(body) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const data = (payload.organic_results ?? [])
    .filter((row) => row.title && row.link)
    .map((row) => ({
      title: row.title!.trim(),
      url: row.link!.trim(),
      description: row.snippet?.trim() ?? "",
    }));

  return { data, responseSize: body.length, quotaRemaining: parseQuotaFromHeaders(response.headers) };
}

export async function executeGoogleCseSearch(
  query: string,
  maxResults: number,
): Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }> {
  const config = getGoogleCseConfig();
  if (!config) throw new Error("Google CSE config ontbreekt");

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("cx", config.cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(maxResults, 10)));
  url.searchParams.set("gl", "nl");

  const response = await fetch(url.toString());
  const body = await response.text();
  if (!response.ok) throw new Error(`Google CSE HTTP ${response.status}: ${body.slice(0, 200)}`);

  const payload = JSON.parse(body) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
    searchInformation?: { totalResults?: string };
  };

  const data = (payload.items ?? [])
    .filter((row) => row.title && row.link)
    .map((row) => ({
      title: row.title!.trim(),
      url: row.link!.trim(),
      description: row.snippet?.trim() ?? "",
    }));

  return { data, responseSize: body.length, quotaRemaining: parseQuotaFromHeaders(response.headers) };
}

export async function executeBingSearch(
  query: string,
  maxResults: number,
): Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }> {
  const apiKey = getBingSearchApiKey();
  if (!apiKey) throw new Error("Bing Search API key ontbreekt");

  const url = new URL("https://api.bing.microsoft.com/v7.0/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(maxResults, 20)));
  url.searchParams.set("mkt", "nl-NL");

  const response = await fetch(url.toString(), {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Bing Search HTTP ${response.status}: ${body.slice(0, 200)}`);

  const payload = JSON.parse(body) as {
    webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> };
  };

  const data = (payload.webPages?.value ?? [])
    .filter((row) => row.name && row.url)
    .map((row) => ({
      title: row.name!.trim(),
      url: row.url!.trim(),
      description: row.snippet?.trim() ?? "",
    }));

  return { data, responseSize: body.length, quotaRemaining: parseQuotaFromHeaders(response.headers) };
}

const searchExecutors: Record<
  string,
  (query: string, maxResults: number) => Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }>
> = {
  tavily: executeTavilySearch,
  "brave-search": executeBraveSearch,
  serpapi: executeSerpApiSearch,
  "google-cse": executeGoogleCseSearch,
  "bing-search": executeBingSearch,
};

export function getSearchExecutor(providerId: string) {
  return searchExecutors[providerId] ?? null;
}

export async function runSearchProvider(
  provider: ManagedProviderDefinition,
  query: string,
  maxResults: number,
): Promise<{ data: SearchResultItem[]; responseSize: number; quotaRemaining?: number | null }> {
  const executor = getSearchExecutor(provider.id);
  if (!executor) throw new Error(`Geen search executor voor ${provider.id}`);

  pipelineDebug("search.provider.execute", { providerId: provider.id, query, maxResults });
  return executor(query, maxResults);
}
