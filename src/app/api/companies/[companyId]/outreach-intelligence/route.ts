import { createRouteApiHandler } from "@/platform/http/api-handler";
import { createRequestContainer } from "@/platform/di/composition-root";
import { TOKENS } from "@/platform/di/tokens";
import { requireFeature } from "@/platform/config/feature-flags";
import type { OutreachIntelligenceEngine } from "@/features/outreach-intelligence";

type RouteContext = { params: Promise<{ companyId: string }> };

export const GET = createRouteApiHandler<{ intelligence: unknown }, RouteContext>(
  "companies.outreach-intelligence.get",
  async (_request, { auth }, routeContext) => {
    requireFeature("outreach_intelligence");
    const { companyId } = await routeContext.params;
    const container = await createRequestContainer();
    const engine = await container.resolve<OutreachIntelligenceEngine>(
      TOKENS.OutreachIntelligenceEngine,
    );
    const intelligence = await engine.getCurrent(auth.organizationId, companyId);
    return { intelligence };
  },
);

export const POST = createRouteApiHandler<unknown, RouteContext>(
  "companies.outreach-intelligence.generate",
  async (_request, { auth }, routeContext: RouteContext) => {
    requireFeature("outreach_intelligence");
    const { companyId } = await routeContext.params;
    const container = await createRequestContainer();
    const engine = await container.resolve<OutreachIntelligenceEngine>(
      TOKENS.OutreachIntelligenceEngine,
    );
    return engine.generate(auth.organizationId, auth.userId, companyId);
  },
);
