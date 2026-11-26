import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { SupabaseRecruitmentIntelligenceRepository } from "@/features/recruitment-intelligence/repositories/supabase-recruitment-intelligence.repository";
import { RecruitmentIntelligenceEngine } from "@/features/recruitment-intelligence/services/recruitment-intelligence-engine.service";

export async function createRecruitmentIntelligenceEngine(
  client?: SupabaseClient,
): Promise<RecruitmentIntelligenceEngine> {
  const supabase = client ?? (await createClient());
  return new RecruitmentIntelligenceEngine(new SupabaseRecruitmentIntelligenceRepository(supabase));
}
