import type { SupabaseClient } from "@supabase/supabase-js";

import type { IntelligenceNotification } from "@/features/daily-intelligence/domain/types";
import {
  IntelligenceNotificationsRepositoryError,
  type CreateNotificationInput,
  type IntelligenceNotificationsRepository,
} from "@/features/daily-intelligence/repositories/intelligence-scan.repository";
import type { Database } from "@/types/database";

type NotificationRow = {
  id: string;
  organization_id: string;
  company_id: string;
  scan_run_id: string | null;
  queue_job_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow): IntelligenceNotification {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    scanRunId: row.scan_run_id,
    queueJobId: row.queue_job_id,
    notificationType: row.notification_type as IntelligenceNotification["notificationType"],
    title: row.title,
    message: row.message,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export class SupabaseIntelligenceNotificationsRepository
  implements IntelligenceNotificationsRepository
{
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: CreateNotificationInput): Promise<IntelligenceNotification> {
    const { data, error } = await this.client
      .from("intelligence_notifications")
      .insert({
        organization_id: input.organizationId,
        company_id: input.companyId,
        scan_run_id: input.scanRunId ?? null,
        queue_job_id: input.queueJobId ?? null,
        notification_type: input.notificationType,
        title: input.title,
        message: input.message,
        payload: (input.payload ?? {}) as never,
      } as never)
      .select("*")
      .single();

    if (error || !data) {
      throw new IntelligenceNotificationsRepositoryError("Notificatie kon niet worden aangemaakt.");
    }

    return mapNotification(data as NotificationRow);
  }

  async createBatch(inputs: CreateNotificationInput[]): Promise<IntelligenceNotification[]> {
    if (inputs.length === 0) return [];

    const rows = inputs.map((input) => ({
      organization_id: input.organizationId,
      company_id: input.companyId,
      scan_run_id: input.scanRunId ?? null,
      queue_job_id: input.queueJobId ?? null,
      notification_type: input.notificationType,
      title: input.title,
      message: input.message,
      payload: (input.payload ?? {}) as never,
    }));

    const { data, error } = await this.client
      .from("intelligence_notifications")
      .insert(rows as never)
      .select("*");

    if (error) {
      throw new IntelligenceNotificationsRepositoryError("Notificaties aanmaken mislukt.");
    }

    return ((data ?? []) as NotificationRow[]).map(mapNotification);
  }

  async listUnread(organizationId: string, limit = 20): Promise<IntelligenceNotification[]> {
    const { data, error } = await this.client
      .from("intelligence_notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new IntelligenceNotificationsRepositoryError("Notificaties laden mislukt.");
    }

    return ((data ?? []) as NotificationRow[]).map(mapNotification);
  }

  async listRecent(organizationId: string, limit = 50): Promise<IntelligenceNotification[]> {
    const { data, error } = await this.client
      .from("intelligence_notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new IntelligenceNotificationsRepositoryError("Notificaties laden mislukt.");
    }

    return ((data ?? []) as NotificationRow[]).map(mapNotification);
  }

  async markRead(organizationId: string, notificationIds: string[]): Promise<number> {
    if (notificationIds.length === 0) return 0;

    const { data, error } = await this.client
      .from("intelligence_notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .in("id", notificationIds)
      .is("read_at", null)
      .select("id");

    if (error) {
      throw new IntelligenceNotificationsRepositoryError("Notificaties markeren mislukt.");
    }

    return data?.length ?? 0;
  }

  async countUnread(organizationId: string): Promise<number> {
    const { count, error } = await this.client
      .from("intelligence_notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("read_at", null);

    if (error) {
      throw new IntelligenceNotificationsRepositoryError("Ongelezen notificaties tellen mislukt.");
    }

    return count ?? 0;
  }
}
