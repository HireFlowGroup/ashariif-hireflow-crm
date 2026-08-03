import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseOutreachGeneratorRepository } from "@/features/outreach-generator/repositories/supabase-outreach-generator.repository";
import { OutreachGeneratorService } from "@/features/outreach-generator/services/outreach-generator.service";
import { SupabaseOutreachIntelligenceRepository } from "@/features/outreach-intelligence/repositories/supabase-outreach-intelligence.repository";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export function createOutreachGeneratorServiceFromClient(
  client: SupabaseClient<Database>,
): OutreachGeneratorService {
  return new OutreachGeneratorService(
    new SupabaseOutreachGeneratorRepository(client),
    new SupabaseOutreachIntelligenceRepository(client),
  );
}

export async function createOutreachGeneratorService(): Promise<OutreachGeneratorService> {
  const client = await createClient();
  return createOutreachGeneratorServiceFromClient(client);
}
