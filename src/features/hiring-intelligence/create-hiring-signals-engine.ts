import { HiringSignalsEngine } from "@/features/hiring-intelligence/services/hiring-signals-engine.service";
import { SupabaseHiringSignalsRepository } from "@/features/hiring-intelligence/repositories/supabase-hiring-signals.repository";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import { createClient } from "@/lib/supabase/server";

export async function createHiringSignalsEngine(
  companiesService: CompaniesService,
): Promise<HiringSignalsEngine> {
  const client = await createClient();
  return new HiringSignalsEngine(new SupabaseHiringSignalsRepository(client), companiesService);
}
