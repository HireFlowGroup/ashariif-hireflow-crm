import type { SupabaseClient } from "@supabase/supabase-js";

import { DashboardService } from "@/features/dashboard/services/dashboard.service";
import { SupabaseDashboardRepository } from "@/features/dashboard/repositories/supabase-dashboard.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createDashboardServiceFromClient(
  client: SupabaseClient<Database>,
): DashboardService {
  return new DashboardService(new SupabaseDashboardRepository(client));
}

export async function createDashboardService(): Promise<DashboardService> {
  const client = await createClient();
  return createDashboardServiceFromClient(client);
}
