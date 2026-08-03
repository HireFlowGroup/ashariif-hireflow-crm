import type { SupabaseClient } from "@supabase/supabase-js";

import { OutreachIntelligenceEngine } from "@/features/outreach-intelligence/services/outreach-intelligence.engine";
import { SupabaseOutreachIntelligenceRepository } from "@/features/outreach-intelligence/repositories/supabase-outreach-intelligence.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createOutreachIntelligenceEngineFromClient(
  client: SupabaseClient<Database>,
): OutreachIntelligenceEngine {
  return new OutreachIntelligenceEngine(new SupabaseOutreachIntelligenceRepository(client));
}

export async function createOutreachIntelligenceEngine(): Promise<OutreachIntelligenceEngine> {
  const client = await createClient();
  return createOutreachIntelligenceEngineFromClient(client);
}
