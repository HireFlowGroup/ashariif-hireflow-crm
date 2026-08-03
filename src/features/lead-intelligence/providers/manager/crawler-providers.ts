import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";
import { getFirecrawlApiKey, isPlaywrightEnabled } from "@/features/lead-intelligence/providers/manager/provider-env";
import type { CrawlResult, ManagedProviderDefinition } from "@/features/lead-intelligence/providers/manager/types";

const JS_SHELL_MARKERS = [
  "enable javascript",
  "javascript is required",
  "please enable javascript",
  "noscript",
  "__next_data__",
  "react-root",
  "id=\"app\"",
];

function normalizeUrl(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

function looksLikeJsShell(html: string): boolean {
  const lower = html.toLowerCase();
  const textLength = html.replace(/<[^>]+>/g, "").trim().length;

  if (textLength < 120) return true;

  return JS_SHELL_MARKERS.some((marker) => lower.includes(marker)) && textLength < 800;
}

async function fetchHtml(url: string, timeoutMs: number): Promise<{ html: string; responseSize: number }> {
  const response = await fetch(normalizeUrl(url), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "HireFlow-RecruitmentIntelligence/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} voor ${url}`);
  }

  const html = (await response.text()).slice(0, 500_000);
  return { html, responseSize: html.length };
}

export async function executeFirecrawlCrawl(
  url: string,
  timeoutMs: number,
): Promise<{ data: CrawlResult; responseSize: number }> {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) throw new Error("Firecrawl API key ontbreekt");

  const targetUrl = normalizeUrl(url);

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: targetUrl,
      formats: ["markdown", "html"],
      onlyMainContent: false,
      timeout: Math.min(timeoutMs, 30_000),
    }),
    signal: AbortSignal.timeout(timeoutMs + 5_000),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Firecrawl HTTP ${response.status}: ${body.slice(0, 200)}`);

  const payload = JSON.parse(body) as {
    success?: boolean;
    data?: { markdown?: string; html?: string; metadata?: Record<string, unknown> };
  };

  if (!payload.success || !payload.data) {
    throw new Error("Firecrawl retourneerde geen data");
  }

  const html = payload.data.html ?? "";
  const markdown = payload.data.markdown ?? html;

  return {
    data: {
      url: targetUrl,
      html,
      markdown,
      metadata: payload.data.metadata ?? {},
    },
    responseSize: body.length,
  };
}

export async function executeNativeCrawl(
  url: string,
  timeoutMs: number,
): Promise<{ data: CrawlResult; responseSize: number }> {
  const targetUrl = normalizeUrl(url);
  const { html, responseSize } = await fetchHtml(targetUrl, timeoutMs);

  const careersPaths = ["/careers", "/vacatures", "/jobs", "/werken-bij", "/vacature"];
  const base = new URL(targetUrl);
  const extraPages: string[] = [];

  for (const path of careersPaths) {
    extraPages.push(`${base.origin}${path}`);
  }

  let combinedHtml = html;

  for (const pageUrl of extraPages.slice(0, 2)) {
    try {
      const extra = await fetchHtml(pageUrl, Math.min(timeoutMs, 10_000));
      combinedHtml += `\n<!-- native-crawler:${pageUrl} -->\n${extra.html.slice(0, 50_000)}`;
    } catch {
      // careers page may not exist
    }
  }

  return {
    data: {
      url: targetUrl,
      html: combinedHtml,
      markdown: combinedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      metadata: { crawler: "native" },
    },
    responseSize: responseSize + combinedHtml.length,
  };
}

export async function executeHttpFetchCrawl(
  url: string,
  timeoutMs: number,
): Promise<{ data: CrawlResult; responseSize: number }> {
  const targetUrl = normalizeUrl(url);
  const { html, responseSize } = await fetchHtml(targetUrl, timeoutMs);

  return {
    data: {
      url: targetUrl,
      html,
      markdown: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      metadata: { crawler: "http-fetch" },
    },
    responseSize,
  };
}

export async function executePlaywrightCrawl(
  url: string,
  timeoutMs: number,
): Promise<{ data: CrawlResult; responseSize: number }> {
  if (!isPlaywrightEnabled()) {
    throw new Error("Playwright crawler niet ingeschakeld");
  }

  let chromium: typeof import("playwright").chromium;

  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright pakket niet geïnstalleerd (npm install playwright)");
  }

  const targetUrl = normalizeUrl(url);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: timeoutMs,
    });

    const html = await page.content();
    const markdown = await page.evaluate(() => document.body?.innerText ?? "");

    return {
      data: {
        url: targetUrl,
        html: html.slice(0, 500_000),
        markdown: markdown.slice(0, 200_000),
        metadata: { crawler: "playwright" },
      },
      responseSize: html.length,
    };
  } finally {
    await browser.close();
  }
}

const crawlerExecutors: Record<
  string,
  (url: string, timeoutMs: number) => Promise<{ data: CrawlResult; responseSize: number }>
> = {
  firecrawl: executeFirecrawlCrawl,
  "native-crawler": executeNativeCrawl,
  "http-fetch": executeHttpFetchCrawl,
  playwright: executePlaywrightCrawl,
};

export function getCrawlerExecutor(providerId: string) {
  return crawlerExecutors[providerId] ?? null;
}

export function shouldEscalateToPlaywright(html: string): boolean {
  return looksLikeJsShell(html);
}

export async function runCrawlerProvider(
  provider: ManagedProviderDefinition,
  url: string,
): Promise<{ data: CrawlResult; responseSize: number; quotaRemaining?: number | null }> {
  const executor = getCrawlerExecutor(provider.id);
  if (!executor) throw new Error(`Geen crawler executor voor ${provider.id}`);

  pipelineDebug("crawler.provider.execute", { providerId: provider.id, url });
  return executor(url, provider.timeoutMs);
}
