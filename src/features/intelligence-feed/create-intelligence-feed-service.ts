import { IntelligenceFeedService } from "@/features/intelligence-feed/services/intelligence-feed.service";
import { SupabaseIntelligenceFeedRepository } from "@/features/intelligence-feed/repositories/supabase-intelligence-feed.repository";
import { createClient } from "@/lib/supabase/server";

export async function createIntelligenceFeedService(): Promise<IntelligenceFeedService> {
  const client = await createClient();
  return new IntelligenceFeedService(new SupabaseIntelligenceFeedRepository(client));
}
