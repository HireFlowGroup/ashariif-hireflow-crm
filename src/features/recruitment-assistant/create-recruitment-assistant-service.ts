import type { SupabaseClient } from "@supabase/supabase-js";

import { RecruitmentAssistantService } from "@/features/recruitment-assistant/services/recruitment-assistant.service";
import { SupabaseRecruitmentAssistantRepository } from "@/features/recruitment-assistant/repositories/supabase-recruitment-assistant.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createRecruitmentAssistantServiceFromClient(
  client: SupabaseClient<Database>,
): RecruitmentAssistantService {
  return new RecruitmentAssistantService(new SupabaseRecruitmentAssistantRepository(client));
}

export async function createRecruitmentAssistantService(): Promise<RecruitmentAssistantService> {
  const client = await createClient();
  return createRecruitmentAssistantServiceFromClient(client);
}
