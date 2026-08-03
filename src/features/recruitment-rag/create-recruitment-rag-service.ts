import { SupabaseRecruitmentRagRepository } from "@/features/recruitment-rag/repositories/supabase-recruitment-rag.repository";
import { RecruitmentRagService } from "@/features/recruitment-rag/services/recruitment-rag.service";
import { createClient } from "@/lib/supabase/server";

export async function createRecruitmentRagService(): Promise<RecruitmentRagService> {
  const client = await createClient();
  return new RecruitmentRagService(new SupabaseRecruitmentRagRepository(client), client);
}
