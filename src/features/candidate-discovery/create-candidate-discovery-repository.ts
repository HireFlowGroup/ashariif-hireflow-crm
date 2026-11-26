import "server-only";

import { SupabaseCandidateDiscoveryRepository } from "@/features/candidate-discovery/repositories/supabase-candidate-discovery.repository";
import type { CandidateDiscoveryRepository } from "@/features/candidate-discovery/repositories/candidate-discovery.repository";
import { createClient } from "@/lib/supabase/server";

export async function createCandidateDiscoveryRepository(): Promise<CandidateDiscoveryRepository> {
  const client = await createClient();
  return new SupabaseCandidateDiscoveryRepository(client);
}