import { HiringSignalsTimelineService } from "@/features/hiring-signals-timeline/services/hiring-signals-timeline.service";
import { SupabaseHiringSignalsTimelineRepository } from "@/features/hiring-signals-timeline/repositories/supabase-hiring-signals-timeline.repository";
import { createClient } from "@/lib/supabase/server";

export async function createHiringSignalsTimelineService(): Promise<HiringSignalsTimelineService> {
  const client = await createClient();
  return new HiringSignalsTimelineService(new SupabaseHiringSignalsTimelineRepository(client));
}
