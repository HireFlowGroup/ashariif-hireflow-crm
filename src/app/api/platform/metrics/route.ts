import { createApiHandler } from "@/platform/http/api-handler";
import { metrics } from "@/platform/observability/metrics";

export const GET = createApiHandler(
  "platform.metrics",
  async () => ({
    metrics: metrics.snapshot(),
    generatedAt: new Date().toISOString(),
  }),
  { rateLimit: 30 },
);
