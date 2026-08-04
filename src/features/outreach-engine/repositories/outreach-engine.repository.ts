import type {
  CreateOutreachDraftInput,
  OutreachCampaign,
  OutreachEvent,
  OutreachMessage,
  OutreachMessageStatus,
} from "@/features/outreach-engine/domain/types";

export type OutreachEngineContext = {
  organizationId: string;
  userId: string;
};

export interface OutreachEngineRepository {
  getDefaultCampaign(organizationId: string): Promise<OutreachCampaign | null>;

  createCampaign(
    organizationId: string,
    userId: string,
    input: Partial<OutreachCampaign>,
  ): Promise<OutreachCampaign>;

  createMessage(
    organizationId: string,
    userId: string,
    input: {
      campaignId: string | null;
      companyId: string;
      contactId: string | null;
      recipientName: string | null;
      recipientEmail: string;
      subject: string;
      bodyText: string;
      status: OutreachMessageStatus;
      personalizationData: Record<string, unknown>;
      idempotencyKey: string;
      provider: string | null;
    },
  ): Promise<OutreachMessage>;

  updateMessage(
    organizationId: string,
    messageId: string,
    updates: Partial<{
      subject: string;
      bodyText: string;
      bodyHtml: string | null;
      status: OutreachMessageStatus;
      approvedBy: string;
      approvedAt: string;
      sentAt: string;
      provider: string;
      providerMessageId: string;
      errorMessage: string;
      retryCount: number;
    }>,
  ): Promise<OutreachMessage>;

  getMessage(organizationId: string, messageId: string): Promise<OutreachMessage | null>;

  listMessages(
    organizationId: string,
    filters?: { status?: OutreachMessageStatus[]; limit?: number },
  ): Promise<OutreachMessage[]>;

  logEvent(
    organizationId: string,
    messageId: string,
    eventType: OutreachEvent["eventType"],
    metadata?: Record<string, unknown>,
  ): Promise<OutreachEvent>;

  getSuppressedEmails(organizationId: string): Promise<Set<string>>;

  getBouncedEmails(organizationId: string): Promise<Set<string>>;

  getRecentlyContactedCompanyIds(
    organizationId: string,
    cooldownDays: number,
  ): Promise<Set<string>>;

  countSentToday(organizationId: string): Promise<number>;

  getActiveRecipientEmails(organizationId: string): Promise<Set<string>>;

  addSuppression(
    organizationId: string,
    email: string,
    reason: string,
    userId: string,
    companyId?: string | null,
    contactId?: string | null,
  ): Promise<void>;
}
