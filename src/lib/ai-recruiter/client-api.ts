import {
  AiRecruiterClientError,
  assertUuid,
  logAiRecruiterClientError,
  toAiRecruiterClientError,
} from "@/lib/ai-recruiter/client-errors";

type FetchJsonOptions = {
  method?: string;
  body?: unknown;
  expectedStatuses?: number[];
};

function resolveApiUrl(operation: string, path: string): string {
  const trimmed = path.trim();

  if (!trimmed.startsWith("/")) {
    throw new AiRecruiterClientError(operation, "API-pad moet relatief beginnen met /.", {
      context: { path },
    });
  }

  try {
    if (typeof window !== "undefined") {
      const absolute = new URL(trimmed, window.location.origin).toString();
      console.debug(`[AI Recruiter] ${operation} → ${absolute}`);
      return trimmed;
    }

    new URL(trimmed, "http://localhost:3000");
    return trimmed;
  } catch (error) {
    throw new AiRecruiterClientError(operation, "Kon API-URL niet opbouwen.", {
      context: { path: trimmed, origin: typeof window !== "undefined" ? window.location.origin : null },
      cause: error,
    });
  }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  const looksJson =
    contentType.includes("application/json") ||
    contentType.includes("+json") ||
    raw.startsWith("{") ||
    raw.startsWith("[");

  if (!looksJson) {
    throw new AiRecruiterClientError("parseResponse", "API gaf geen JSON terug.", {
      context: {
        status: response.status,
        statusText: response.statusText,
        contentType,
        bodyPreview: raw.slice(0, 240),
        url: response.url,
      },
    });
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new AiRecruiterClientError("parseResponse", "API-response is geen geldige JSON.", {
      context: {
        status: response.status,
        contentType,
        bodyPreview: raw.slice(0, 240),
        url: response.url,
      },
      cause: error,
    });
  }
}

export async function aiRecruiterFetchJson<T>(
  operation: string,
  path: string,
  options: FetchJsonOptions = {},
): Promise<{ data: T; response: Response }> {
  const url = resolveApiUrl(operation, path);
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: { Accept: "application/json" },
  };

  if (options.body !== undefined) {
    init.method = options.method ?? "POST";
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(options.body);
  }

  console.debug(`[AI Recruiter] ${operation}`, {
    method: init.method,
    url,
    body: options.body,
  });

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw toAiRecruiterClientError(error, operation, { url, method: init.method });
  }

  const payload = await readResponsePayload(response);
  const expected = options.expectedStatuses ?? [200, 201];

  if (!expected.includes(response.status)) {
    const apiError =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `HTTP ${response.status} ${response.statusText}`;

    throw new AiRecruiterClientError(operation, apiError, {
      context: { url, status: response.status, payload },
    });
  }

  return { data: payload as T, response };
}

export function buildRunStreamPath(runId: string): string {
  assertUuid("buildRunStreamPath", "runId", runId);
  return `/api/ai-recruiter/runs/${runId}/stream`;
}

export function buildRunDetailPath(runId: string): string {
  assertUuid("buildRunDetailPath", "runId", runId);
  return `/api/ai-recruiter/runs/${runId}`;
}

export function buildOutreachMessagePath(messageId: string, action: "approve" | "send"): string {
  assertUuid("buildOutreachMessagePath", "messageId", messageId);
  return `/api/outreach/messages/${messageId}/${action}`;
}

export function openRecruiterEventSource(
  operation: string,
  runId: string,
  listeners: {
    onRunStatus?: (data: { status: string; message?: string }) => void;
    onPipeline?: (data: { steps: unknown[] }) => void;
    onItem?: (data: { item: unknown }) => void;
    onCounters?: (data: { counters: unknown }) => void;
    onComplete?: (data: { run: unknown }) => void;
    onError?: (message: string) => void;
  },
): EventSource {
  const path = buildRunStreamPath(runId);

  let eventSource: EventSource;

  try {
    eventSource = new EventSource(path);
    console.debug(`[AI Recruiter] ${operation} EventSource`, { runId, path });
  } catch (error) {
    throw toAiRecruiterClientError(error, operation, { runId, path });
  }

  const parseEvent = <T,>(label: string, raw: string): T => {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      throw toAiRecruiterClientError(error, `${operation}:${label}`, { runId, rawPreview: raw.slice(0, 120) });
    }
  };

  if (listeners.onRunStatus) {
    eventSource.addEventListener("run_status", (event) => {
      listeners.onRunStatus?.(parseEvent("run_status", event.data));
    });
  }

  if (listeners.onPipeline) {
    eventSource.addEventListener("pipeline", (event) => {
      listeners.onPipeline?.(parseEvent("pipeline", event.data));
    });
  }

  if (listeners.onItem) {
    eventSource.addEventListener("item", (event) => {
      listeners.onItem?.(parseEvent("item", event.data));
    });
  }

  if (listeners.onCounters) {
    eventSource.addEventListener("counters", (event) => {
      listeners.onCounters?.(parseEvent("counters", event.data));
    });
  }

  if (listeners.onComplete) {
    eventSource.addEventListener("complete", (event) => {
      listeners.onComplete?.(parseEvent("complete", event.data));
    });
  }

  eventSource.addEventListener("error", (event) => {
    if (event instanceof MessageEvent && typeof event.data === "string" && event.data.length > 0) {
      try {
        const data = parseEvent<{ message?: string }>("sse_error", event.data);
        listeners.onError?.(data.message ?? "Streamfout");
        return;
      } catch (error) {
        logAiRecruiterClientError(error, `${operation}:sse_error`);
      }
    }
    listeners.onError?.("EventSource verbinding verbroken");
  });

  return eventSource;
}

export { logAiRecruiterClientError, toAiRecruiterClientError };
