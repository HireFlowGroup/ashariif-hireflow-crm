import { NextResponse } from "next/server";

import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import type { ToolExecutionContext } from "@/lib/ai/tools/types";
import { DomainError } from "@/platform/errors/domain-error";
import { mapErrorToHttp } from "@/platform/errors/http-error-mapper";
import { withVersionHeaders } from "@/platform/http/api-version";
import { checkRateLimit } from "@/platform/http/rate-limiter";
import { createRequestId, createLogger } from "@/platform/observability/logger";
import { apiDurationHistogram, apiRequestCounter } from "@/platform/observability/metrics";
import { tracer } from "@/platform/observability/tracing";

export type ApiHandlerContext = {
  requestId: string;
  auth: ToolExecutionContext;
  logger: ReturnType<typeof createLogger>;
};

export type ApiHandlerOptions = {
  requireAuth?: boolean;
  rateLimitKey?: (auth: ToolExecutionContext) => string;
  rateLimit?: number;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

export function createApiHandler<T>(
  name: string,
  handler: (request: Request, context: ApiHandlerContext) => Promise<T>,
  options?: ApiHandlerOptions,
): (request: Request) => Promise<Response>;
export function createApiHandler<T, C>(
  name: string,
  handler: (request: Request, context: ApiHandlerContext, routeContext: C) => Promise<T>,
  options?: ApiHandlerOptions,
): (request: Request, routeContext: C) => Promise<Response>;
export function createApiHandler<T, C = never>(
  name: string,
  handler: (
    request: Request,
    context: ApiHandlerContext,
    routeContext?: C,
  ) => Promise<T>,
  options: ApiHandlerOptions = {},
): (request: Request, routeContext?: C) => Promise<Response> {
  const requireAuth = options.requireAuth ?? true;

  return async (request: Request, routeContext?: C) => {
    const requestId = createRequestId();
    const started = Date.now();
    const logger = createLogger({ requestId, handler: name });

    try {
      return await tracer.withSpan(
        `api.${name}`,
        async () => {
          let authContext: ToolExecutionContext | undefined;

          if (requireAuth) {
            const auth = await getAuthenticatedServiceContext();
            if (!auth) {
              throw new DomainError("UNAUTHORIZED", "Niet geautoriseerd.", { statusCode: 401 });
            }
            authContext = auth;

            const rateKey =
              options.rateLimitKey?.(auth) ?? `org:${auth.organizationId}:user:${auth.userId}`;
            const rate = checkRateLimit(rateKey, options.rateLimit);

            if (!rate.allowed) {
              throw new DomainError("RATE_LIMITED", "Te veel verzoeken. Probeer later opnieuw.", {
                statusCode: 429,
                details: { resetAt: rate.resetAt, limit: rate.limit },
              });
            }
          }

          const result = await handler(request, {
            requestId,
            auth: authContext as ToolExecutionContext,
            logger,
          }, routeContext);

          apiRequestCounter.inc({ handler: name, status: "success" });
          apiDurationHistogram.observe(Date.now() - started, { handler: name });

          const response = NextResponse.json(result, { headers: JSON_HEADERS });
          return withVersionHeaders(response);
        },
        { "http.route": name },
      );
    } catch (error) {
      apiRequestCounter.inc({ handler: name, status: "error" });
      logger.error("api.handler.error", {
        error: error instanceof Error ? error.message : "unknown",
      });

      const mapped = mapErrorToHttp(error, requestId);
      const response = NextResponse.json(mapped.body, {
        status: mapped.status,
        headers: JSON_HEADERS,
      });
      return withVersionHeaders(response);
    }
  };
}

export function createRouteApiHandler<T, C>(
  name: string,
  handler: (request: Request, context: ApiHandlerContext, routeContext: C) => Promise<T>,
  options: ApiHandlerOptions = {},
): (request: Request, routeContext: C) => Promise<Response> {
  return createApiHandler(name, handler, options) as (
    request: Request,
    routeContext: C,
  ) => Promise<Response>;
}
