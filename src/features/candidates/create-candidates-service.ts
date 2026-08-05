import type { SupabaseClient } from "@supabase/supabase-js";

import { CandidatesService } from "@/features/candidates/services/candidates.service";
import { SupabaseCandidatesRepository } from "@/features/candidates/repositories/supabase-candidates.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createCandidatesServiceFromClient(
  client: SupabaseClient<Database>,
): CandidatesService {
  return new CandidatesService(new SupabaseCandidatesRepository(client));
}

export async function createCandidatesService(): Promise<CandidatesService> {
  const client = await createClient();
  return createCandidatesServiceFromClient(client);
}
