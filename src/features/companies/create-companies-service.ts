import type { SupabaseClient } from "@supabase/supabase-js";

import { CompaniesService } from "@/features/companies/services/companies.service";
import { SupabaseCompaniesRepository } from "@/features/companies/repositories/supabase-companies.repository";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/service";
import type { Database } from "@/types/database";

export function createCompaniesServiceFromClient(
  client: SupabaseClient<Database>,
): CompaniesService {
  return new CompaniesService(new SupabaseCompaniesRepository(client));
}

/** Server-side factory for the companies application service (user-scoped RLS client). */
export async function createCompaniesService(
  client?: SupabaseClient<Database>,
): Promise<CompaniesService> {
  const supabase = client ?? (await createClient());
  return createCompaniesServiceFromClient(supabase);
}

/**
 * Trusted server write client for Company Finder / discovery saves.
 * Uses service_role when configured (bypasses RLS); org scoping stays in the service layer.
 * Falls back to the authenticated session client for local dev without service role key.
 */
export function createCompaniesWriteClient(
  authenticatedClient: SupabaseClient<Database>,
): SupabaseClient<Database> {
  if (isServiceRoleConfigured()) {
    return createServiceRoleClient();
  }

  return authenticatedClient;
}

export async function createCompaniesServiceWithWriteClient(
  authenticatedClient: SupabaseClient<Database>,
): Promise<CompaniesService> {
  return createCompaniesServiceFromClient(createCompaniesWriteClient(authenticatedClient));
}
