import { isManagedProviderId } from "@/features/provider-vault";
import { createVaultForContext, withProviderVaultContext } from "@/features/provider-vault/server";
import { DomainError } from "@/platform/errors/domain-error";
import { createRouteApiHandler } from "@/platform/http/api-handler";

type RouteContext = { params: Promise<{ providerId: string }> };

export const POST = createRouteApiHandler<unknown, RouteContext>(
  "settings.providers.reset-cache",
  async (_request, ctx, routeContext) => {
    const { providerId } = await routeContext.params;

    if (!isManagedProviderId(providerId)) {
      throw new DomainError("VALIDATION_ERROR", "Onbekende provider.");
    }

    return withProviderVaultContext(ctx.auth, async () => {
      const vault = await createVaultForContext(ctx.auth);
      vault.resetProviderCache(providerId);

      return { success: true, message: `Cache voor ${providerId} gewist.` };
    });
  },
);
