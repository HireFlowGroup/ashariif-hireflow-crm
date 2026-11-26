/** Parse provider errors like `SerpAPI HTTP 503: ...` or `Tavily HTTP 432: ...`. */
export function parseHttpStatusFromProviderMessage(message: string): number | null {
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  if (!match) return null;
  const status = parseInt(match[1] ?? "", 10);
  return Number.isFinite(status) ? status : null;
}

export type ProviderRetryDecision = {
  allowRetry: boolean;
  /** When set, used instead of default exponential backoff before the next attempt. */
  backoffMs?: number;
};

const SERP_UNAVAILABLE_RETRY_BACKOFF_MS = 1_500;

/**
 * Fail-fast on quota/auth; single short retry on upstream 503; default otherwise.
 */
export function resolveProviderRetryDecision(
  errorMessage: string,
  attempt: number,
  configuredMaxRetries: number,
): ProviderRetryDecision {
  const lower = errorMessage.toLowerCase();
  const status = parseHttpStatusFromProviderMessage(errorMessage);

  if (status === 432 || status === 429) {
    return { allowRetry: false };
  }

  if (status === 401 || status === 403) {
    return { allowRetry: false };
  }

  if (status === 503) {
    return {
      allowRetry: attempt < 1,
      backoffMs: SERP_UNAVAILABLE_RETRY_BACKOFF_MS,
    };
  }

  if (
    /timeout na \d+ms|time-out na \d+ms|timed out|etimedout|aborterror|the operation was aborted/.test(
      lower,
    )
  ) {
    return { allowRetry: false };
  }

  return { allowRetry: attempt < configuredMaxRetries };
}