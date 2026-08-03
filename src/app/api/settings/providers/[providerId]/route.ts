import { isManagedProviderId } from "@/features/provider-vault";
import { saveProviderConfigSchema } from "@/features/provider-vault/shared/validation/provider-vault.schemas";
import { createVaultForContext, withProviderVaultContext } from "@/features/provider-vault/server";
import { DomainError } from "@/platform/errors/domain-error";
import { createRouteApiHandler } from "@/platform/http/api-handler";

type RouteContext = { params: Promise<{ providerId: string }> };

export const PUT = createRouteApiHandler<unknown, RouteContext>(
  "settings.providers.save",
  async (request, ctx, routeContext) => {
    const { providerId } = await routeContext.params;

    if (!isManagedProviderId(providerId)) {
      throw new DomainError("VALIDATION_ERROR", "Onbekende provider.");
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new DomainError("VALIDATION_ERROR", "Ongeldige JSON.");
    }

    const parsed = saveProviderConfigSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Ongeldige configuratie.",
      );
    }

    return withProviderVaultContext(ctx.auth, async () => {
      const vault = await createVaultForContext(ctx.auth);
      const providers = await vault.saveProviderConfig({
        organizationId: ctx.auth.organizationId,
        userId: ctx.auth.userId,
        providerId,
        enabled: parsed.data.enabled,
        secrets: parsed.data.secrets,
      });

      return { success: true, providers };
    });
  },
);

export const DELETE = createRouteApiHandler<unknown, RouteContext>(
  "settings.providers.clear",
  async (_request, ctx, routeContext) => {
    const { providerId } = await routeContext.params;

    if (!isManagedProviderId(providerId)) {
      throw new DomainError("VALIDATION_ERROR", "Onbekende provider.");
    }

    return withProviderVaultContext(ctx.auth, async () => {
      const vault = await createVaultForContext(ctx.auth);
      const providers = await vault.clearProviderSecrets(
        ctx.auth.organizationId,
        providerId,
      );

      return { success: true, providers };
    });
  },
);
