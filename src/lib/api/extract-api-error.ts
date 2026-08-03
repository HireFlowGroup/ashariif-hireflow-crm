type ApiErrorBody = {
  message?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

/** Reads a user-facing message from HireFlow API JSON (success or error envelope). */
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const body = payload as ApiErrorBody;

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body.error?.message === "string" && body.error.message.trim()) {
    return body.error.message;
  }

  return fallback;
}
