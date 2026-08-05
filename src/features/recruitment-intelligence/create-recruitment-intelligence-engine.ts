import { createClient } from "@/lib/supabase/server";
import { SupabaseRecruitmentIntelligenceRepository } from "@/features/recruitment-intelligence/repositories/supabase-recruitment-intelligence.repository";
import { RecruitmentIntelligenceEngine } from "@/features/recruitment-intelligence/services/recruitment-intelligence-engine.service";

export async function createRecruitmentIntelligenceEngine(): Promise<RecruitmentIntelligenceEngine> {
  const client = await createClient();
  return new RecruitmentIntelligenceEngine(new SupabaseRecruitmentIntelligenceRepository(client));
}
