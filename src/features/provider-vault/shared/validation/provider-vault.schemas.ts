import { z } from "zod";

import { MANAGED_PROVIDER_IDS } from "@/features/provider-vault/shared/domain/provider-definitions";

export const saveProviderConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  secrets: z.record(z.string().trim().min(1).max(500)).default({}),
});

export const providerIdParamSchema = z.object({
  providerId: z.enum(MANAGED_PROVIDER_IDS),
});
