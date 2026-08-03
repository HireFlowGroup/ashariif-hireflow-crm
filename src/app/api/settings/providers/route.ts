import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createVaultForContext, withProviderVaultContext } from "@/features/provider-vault/server";
import { createApiHandler } from "@/platform/http/api-handler";

export const GET = createApiHandler(
  "settings.providers.list",
  async (_request, ctx) =>
    withProviderVaultContext(ctx.auth, async () => {
      const vault = await createVaultForContext(ctx.auth);
      const providers = await vault.getProviderSnapshots(ctx.auth.organizationId);
      return { success: true, providers };
    }),
);
