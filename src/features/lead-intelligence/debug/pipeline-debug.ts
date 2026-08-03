/** Temporary pipeline debug logging — enable with COMPANY_FINDER_DEBUG=true */

export function isPipelineDebugEnabled(): boolean {
  return process.env.COMPANY_FINDER_DEBUG === "true";
}

export function pipelineDebug(step: string, data?: Record<string, unknown>): void {
  if (!isPipelineDebugEnabled()) {
    return;
  }

  console.log(`[CompanyFinderPipeline] ${step}`, data ?? {});
}

export function pipelineWarn(step: string, data?: Record<string, unknown>): void {
  console.warn(`[CompanyFinderPipeline] ${step}`, data ?? {});
}

/** Redact API tokens from URLs before logging. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);

    for (const key of ["api_token", "api_key", "token"]) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }

    return parsed.toString();
  } catch {
    return url.replace(/api_token=[^&]+/gi, "api_token=[REDACTED]");
  }
}

export function truncateBody(body: string, maxLength = 500): string {
  if (body.length <= maxLength) {
    return body;
  }

  return `${body.slice(0, maxLength)}…`;
}
