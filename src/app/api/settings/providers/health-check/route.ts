import { getProviderManager } from "@/features/lead-intelligence/providers/manager";
import { MANAGED_PROVIDER_IDS } from "@/features/provider-vault";
import { createVaultForContext, withProviderVaultContext } from "@/features/provider-vault/server";
import { isManagedProviderId } from "@/features/provider-vault";
import { createApiHandler } from "@/platform/http/api-handler";

export const POST = createApiHandler(
  "settings.providers.health-check",
  async (_request, ctx) =>
    withProviderVaultContext(ctx.auth, async () => {
      await getProviderManager().runHealthChecks();
      const vault = await createVaultForContext(ctx.auth);

      for (const providerId of MANAGED_PROVIDER_IDS) {
        if (isManagedProviderId(providerId)) {
          await vault.persistHealthSnapshot(ctx.auth.organizationId, providerId);
        }
      }

      const providers = await vault.getProviderSnapshots(ctx.auth.organizationId);
      return { success: true, providers };
    }),
);
