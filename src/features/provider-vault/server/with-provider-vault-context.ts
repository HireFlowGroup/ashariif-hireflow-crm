import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createProviderVaultService } from "@/features/provider-vault/server/provider-vault.service";
import { runWithOrganizationIdAsync } from "@/features/provider-vault/server/org-context";

export async function withProviderVaultContext<T>(
  context: AuthenticatedServiceContext,
  fn: () => Promise<T>,
): Promise<T> {
  const supabase = await createClient();
  const vault = createProviderVaultService(supabase);
  await vault.warmOrganizationCache(context.organizationId);

  return runWithOrganizationIdAsync(context.organizationId, fn);
}

export async function createVaultForContext(
  context: AuthenticatedServiceContext,
) {
  const supabase = await createClient();
  const vault = createProviderVaultService(supabase);
  await vault.warmOrganizationCache(context.organizationId);
  return vault;
}
