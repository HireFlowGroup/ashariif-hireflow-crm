const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AiRecruiterClientError extends Error {
  readonly operation: string;
  readonly context: Record<string, unknown>;
  readonly causeError?: unknown;

  constructor(
    operation: string,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = "AiRecruiterClientError";
    this.operation = operation;
    this.context = options?.context ?? {};
    this.causeError = options?.cause;

    if (options?.cause instanceof Error && options.cause.stack) {
      this.stack = `${this.stack ?? ""}\nCaused by: ${options.cause.stack}`;
    }
  }
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuid(
  operation: string,
  label: string,
  value: string | null | undefined,
): asserts value is string {
  if (!value || typeof value !== "string") {
    throw new AiRecruiterClientError(operation, `${label} ontbreekt.`, {
      context: { label, value },
    });
  }

  if (!isUuid(value)) {
    throw new AiRecruiterClientError(operation, `${label} is geen geldige UUID.`, {
      context: { label, value },
    });
  }
}

export function logAiRecruiterClientError(error: unknown, operation: string): void {
  if (error instanceof AiRecruiterClientError) {
    console.error(`[AI Recruiter] ${operation} mislukt`, {
      operation: error.operation,
      message: error.message,
      context: error.context,
      cause: error.causeError,
      stack: error.stack,
    });
    return;
  }

  console.error(`[AI Recruiter] ${operation} mislukt`, error);
}

export function toAiRecruiterClientError(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>,
): AiRecruiterClientError {
  if (error instanceof AiRecruiterClientError) {
    return error;
  }

  if (error instanceof Error) {
    const isSafariJsonOrUrl =
      error.message === "The string did not match the expected pattern.";

    const hint = isSafariJsonOrUrl
      ? " (Safari: meestal een ongeldige URL of niet-JSON API-response — controleer Network tab)"
      : "";

    return new AiRecruiterClientError(
      operation,
      `${error.name}: ${error.message}${hint}`,
      { context, cause: error },
    );
  }

  return new AiRecruiterClientError(operation, "Onbekende clientfout.", {
    context: { ...context, error },
    cause: error,
  });
}
