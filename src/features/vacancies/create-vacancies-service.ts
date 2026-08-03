import type { SupabaseClient } from "@supabase/supabase-js";

import { VacanciesService } from "@/features/vacancies/services/vacancies.service";
import { SupabaseVacanciesRepository } from "@/features/vacancies/repositories/supabase-vacancies.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createVacanciesServiceFromClient(
  client: SupabaseClient<Database>,
): VacanciesService {
  return new VacanciesService(new SupabaseVacanciesRepository(client));
}

/** Server-side factory for the vacancies application service. */
export async function createVacanciesService(): Promise<VacanciesService> {
  const client = await createClient();
  return createVacanciesServiceFromClient(client);
}
