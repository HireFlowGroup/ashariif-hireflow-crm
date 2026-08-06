import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  OutreachCampaign,
  OutreachEvent,
  OutreachMessage,
  OutreachMessageStatus,
} from "@/features/outreach-engine/domain/types";
import type { OutreachEngineRepository } from "@/features/outreach-engine/repositories/outreach-engine.repository";

function mapCampaign(row: Record<string, unknown>): OutreachCampaign {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    status: row.status as OutreachCampaign["status"],
    senderName: (row.sender_name as string) ?? null,
    senderEmail: (row.sender_email as string) ?? null,
    subjectTemplate: (row.subject_template as string) ?? null,
    bodyTemplate: (row.body_template as string) ?? null,
    dailyLimit: row.daily_limit as number,
    approvalMode: row.approval_mode as OutreachCampaign["approvalMode"],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapMessage(row: Record<string, unknown>): OutreachMessage {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    campaignId: (row.campaign_id as string) ?? null,
    companyId: row.company_id as string,
    contactId: (row.contact_id as string) ?? null,
    recipientName: (row.recipient_name as string) ?? null,
    recipientEmail: row.recipient_email as string,
    subject: row.subject as string,
    bodyText: row.body_text as string,
    bodyHtml: (row.body_html as string) ?? null,
    status: row.status as OutreachMessageStatus,
    personalizationData: (row.personalization_data as OutreachMessage["personalizationData"]) ?? {
      companyName: "",
      sector: null,
      city: null,
      contactName: null,
      vacancyCount: 0,
      hiringSignal: null,
      fieldsUsed: [],
      warnings: [],
      generatedAt: new Date().toISOString(),
    },
    provider: (row.provider as string) ?? null,
    providerMessageId: (row.provider_message_id as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    idempotencyKey: row.idempotency_key as string,
    retryCount: row.retry_count as number,
    approvedBy: (row.approved_by as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    companyName: (row.company_name as string) ?? undefined,
  };
}

export class SupabaseOutreachEngineRepository implements OutreachEngineRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getDefaultCampaign(organizationId: string): Promise<OutreachCampaign | null> {
    const { data } = await this.client
      .from("outreach_campaigns")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? mapCampaign(data) : null;
  }

  async createCampaign(
    organizationId: string,
    userId: string,
    input: Partial<OutreachCampaign>,
  ): Promise<OutreachCampaign> {
    const { data, error } = await this.client
      .from("outreach_campaigns")
      .insert({
        organization_id: organizationId,
        name: input.name ?? "Standaard outreach",
        status: input.status ?? "draft",
        sender_name: input.senderName,
        sender_email: input.senderEmail,
        subject_template: input.subjectTemplate,
        body_template: input.bodyTemplate,
        daily_limit: input.dailyLimit ?? 10,
        approval_mode: input.approvalMode ?? "manual",
        created_by: userId,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error("Campagne kon niet worden aangemaakt.");
    return mapCampaign(data);
  }

  async createMessage(
    organizationId: string,
    userId: string,
    input: Parameters<OutreachEngineRepository["createMessage"]>[2],
  ): Promise<OutreachMessage> {
    const fullRow = {
      organization_id: organizationId,
      campaign_id: input.campaignId,
      company_id: input.companyId,
      contact_id: input.contactId,
      run_id: input.runId ?? null,
      vacancy_id: input.vacancyId ?? null,
      recipient_name: input.recipientName,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      body_text: input.bodyText,
      status: input.status,
      personalization_data: input.personalizationData,
      personalization_facts:
        (input.personalizationData as { personalizationFacts?: unknown }).personalizationFacts ?? [],
      source_evidence:
        (input.personalizationData as { sourceEvidence?: unknown }).sourceEvidence ?? [],
      idempotency_key: input.idempotencyKey,
      provider: input.provider,
      created_by: userId,
    };

    const fullResult = await this.client.from("outreach_messages").insert(fullRow).select("*").single();
    if (!fullResult.error && fullResult.data) {
      return mapMessage(fullResult.data);
    }

    const fallbackStatus = input.status === "needs_review" ? "pending_approval" : input.status;
    const minimalRow = {
      organization_id: organizationId,
      campaign_id: input.campaignId,
      company_id: input.companyId,
      contact_id: input.contactId,
      recipient_name: input.recipientName,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      body_text: input.bodyText,
      status: fallbackStatus,
      personalization_data: input.personalizationData,
      idempotency_key: input.idempotencyKey,
      provider: input.provider,
      created_by: userId,
    };

    const fallbackResult = await this.client.from("outreach_messages").insert(minimalRow).select("*").single();
    if (fallbackResult.error || !fallbackResult.data) {
      throw new Error(fallbackResult.error?.message ?? fullResult.error?.message ?? "Bericht kon niet worden aangemaakt.");
    }

    console.warn("[OutreachEngine] createMessage used compatibility fallback insert", {
      originalStatus: input.status,
      fallbackStatus,
      originalError: fullResult.error?.message ?? null,
    });

    return mapMessage(fallbackResult.data);
  }

  async updateMessage(
    organizationId: string,
    messageId: string,
    updates: Parameters<OutreachEngineRepository["updateMessage"]>[2],
  ): Promise<OutreachMessage> {
    const row: Record<string, unknown> = {};
    if (updates.subject !== undefined) row.subject = updates.subject;
    if (updates.bodyText !== undefined) row.body_text = updates.bodyText;
    if (updates.bodyHtml !== undefined) row.body_html = updates.bodyHtml;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.approvedBy !== undefined) row.approved_by = updates.approvedBy;
    if (updates.approvedAt !== undefined) row.approved_at = updates.approvedAt;
    if (updates.sentAt !== undefined) row.sent_at = updates.sentAt;
    if (updates.provider !== undefined) row.provider = updates.provider;
    if (updates.providerMessageId !== undefined) row.provider_message_id = updates.providerMessageId;
    if (updates.errorMessage !== undefined) row.error_message = updates.errorMessage;
    if (updates.retryCount !== undefined) row.retry_count = updates.retryCount;
    if (updates.failureCode !== undefined) row.failure_code = updates.failureCode;

    const { data, error } = await this.client
      .from("outreach_messages")
      .update(row)
      .eq("id", messageId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error || !data) throw new Error("Bericht kon niet worden bijgewerkt.");
    return mapMessage(data);
  }

  async getMessage(organizationId: string, messageId: string): Promise<OutreachMessage | null> {
    const { data } = await this.client
      .from("outreach_messages")
      .select("*, companies(name)")
      .eq("id", messageId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!data) return null;
    const row = data as Record<string, unknown>;
    const companies = row.companies as { name: string } | null;
    return mapMessage({ ...row, company_name: companies?.name });
  }

  async listMessages(
    organizationId: string,
    filters?: { status?: OutreachMessageStatus[]; limit?: number },
  ): Promise<OutreachMessage[]> {
    let query = this.client
      .from("outreach_messages")
      .select("*, companies(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(filters?.limit ?? 50);

    if (filters?.status?.length) {
      query = query.in("status", filters.status);
    }

    const { data } = await query;
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const companies = r.companies as { name: string } | null;
      return mapMessage({ ...r, company_name: companies?.name });
    });
  }

  async logEvent(
    organizationId: string,
    messageId: string,
    eventType: OutreachEvent["eventType"],
    metadata: Record<string, unknown> = {},
  ): Promise<OutreachEvent> {
    const { data, error } = await this.client
      .from("outreach_events")
      .insert({
        organization_id: organizationId,
        outreach_message_id: messageId,
        event_type: eventType,
        metadata,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error("Event kon niet worden gelogd.");

    return {
      id: data.id as string,
      organizationId: data.organization_id as string,
      outreachMessageId: data.outreach_message_id as string,
      eventType: data.event_type as OutreachEvent["eventType"],
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      createdAt: data.created_at as string,
    };
  }

  async getSuppressedEmails(organizationId: string): Promise<Set<string>> {
    const { data } = await this.client
      .from("outreach_suppressions")
      .select("email")
      .eq("organization_id", organizationId);

    return new Set((data ?? []).map((r) => (r.email as string).toLowerCase()));
  }

  async getBouncedEmails(organizationId: string): Promise<Set<string>> {
    const { data } = await this.client
      .from("outreach_messages")
      .select("recipient_email")
      .eq("organization_id", organizationId)
      .eq("status", "bounced");

    return new Set((data ?? []).map((r) => (r.recipient_email as string).toLowerCase()));
  }

  async getRecentlyContactedCompanyIds(
    organizationId: string,
    cooldownDays: number,
  ): Promise<Set<string>> {
    const since = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await this.client
      .from("outreach_messages")
      .select("company_id")
      .eq("organization_id", organizationId)
      .eq("status", "sent")
      .gte("sent_at", since);

    return new Set((data ?? []).map((r) => r.company_id as string));
  }

  async countSentToday(organizationId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count } = await this.client
      .from("outreach_messages")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "sent")
      .gte("sent_at", startOfDay.toISOString());

    return count ?? 0;
  }

  async getActiveRecipientEmails(organizationId: string): Promise<Set<string>> {
    const { data } = await this.client
      .from("outreach_messages")
      .select("recipient_email")
      .eq("organization_id", organizationId)
      .in("status", ["draft", "pending_approval", "approved", "queued", "sending"]);

    return new Set((data ?? []).map((r) => (r.recipient_email as string).toLowerCase()));
  }

  async addSuppression(
    organizationId: string,
    email: string,
    reason: string,
    userId: string,
    companyId?: string | null,
    contactId?: string | null,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const row = {
      organization_id: organizationId,
      email: normalizedEmail,
      reason,
      company_id: companyId ?? null,
      contact_id: contactId ?? null,
      created_by: userId,
    };

    const { data: existing } = await this.client
      .from("outreach_suppressions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await this.client
        .from("outreach_suppressions")
        .update({ reason, company_id: row.company_id, contact_id: row.contact_id })
        .eq("id", existing.id)
        .eq("organization_id", organizationId);
      if (error) throw new Error("Suppression kon niet worden bijgewerkt.");
      return;
    }

    const { error } = await this.client.from("outreach_suppressions").insert(row);
    if (error) throw new Error("Suppression kon niet worden toegevoegd.");
  }
}
