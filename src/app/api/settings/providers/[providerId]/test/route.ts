import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { isManagedProviderId } from "@/features/provider-vault";
import { createVaultForContext, withProviderVaultContext } from "@/features/provider-vault/server";
import { DomainError } from "@/platform/errors/domain-error";
import { createRouteApiHandler } from "@/platform/http/api-handler";

type RouteContext = { params: Promise<{ providerId: string }> };

export const POST = createRouteApiHandler<unknown, RouteContext>(
  "settings.providers.test",
  async (_request, ctx, routeContext) => {
    const { providerId } = await routeContext.params;

    return withProviderVaultContext(ctx.auth, async () => {
      const result = await getProviderManager().testProvider(providerId);
      const vault = await createVaultForContext(ctx.auth);

      if (isManagedProviderId(providerId)) {
        await vault.persistHealthSnapshot(ctx.auth.organizationId, providerId);
      }

      return { success: true, result };
    });
  },
);
