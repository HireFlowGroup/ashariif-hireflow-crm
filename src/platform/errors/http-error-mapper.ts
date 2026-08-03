import { DomainError } from "@/platform/errors/domain-error";

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
};

export function mapErrorToHttp(error: unknown, requestId?: string): { status: number; body: ApiErrorEnvelope } {
  if (error instanceof DomainError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
          requestId,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Onbekende serverfout.",
        requestId,
      },
    },
  };
}
