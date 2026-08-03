import { SupabaseIntelligenceNotificationsRepository } from "@/features/daily-intelligence/repositories/supabase-intelligence-notifications.repository";
import { SupabaseIntelligenceScanRepository } from "@/features/daily-intelligence/repositories/supabase-intelligence-scan.repository";
import { DailySchedulerService } from "@/features/daily-intelligence/services/daily-scheduler.service";
import { QueueWorkerService } from "@/features/daily-intelligence/services/queue-worker.service";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/service";

export function isDailyIntelligenceConfigured(): boolean {
  return isServiceRoleConfigured() && Boolean(process.env.CRON_SECRET?.trim());
}

export function createDailyIntelligenceServices() {
  const client = createServiceRoleClient();
  const scanRepository = new SupabaseIntelligenceScanRepository(client);
  const notificationsRepository = new SupabaseIntelligenceNotificationsRepository(client);

  return {
    client,
    scanRepository,
    notificationsRepository,
    scheduler: new DailySchedulerService(scanRepository),
    worker: new QueueWorkerService(scanRepository, notificationsRepository, client),
  };
}
