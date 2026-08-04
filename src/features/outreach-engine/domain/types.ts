export type OutreachCampaignStatus = "draft" | "active" | "paused" | "completed";
export type OutreachApprovalMode = "manual" | "automatic";

export type OutreachMessageStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "bounced"
  | "replied"
  | "cancelled"
  | "blocked_missing_recipient";

export type OutreachEventType =
  | "draft_created"
  | "edited"
  | "approved"
  | "rejected"
  | "queued"
  | "send_attempt"
  | "sent"
  | "failed"
  | "bounced"
  | "reply"
  | "cancelled"
  | "test_sent"
  | "blocked";

export type OutreachCampaign = {
  id: string;
  organizationId: string;
  name: string;
  status: OutreachCampaignStatus;
  senderName: string | null;
  senderEmail: string | null;
  subjectTemplate: string | null;
  bodyTemplate: string | null;
  dailyLimit: number;
  approvalMode: OutreachApprovalMode;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OutreachPersonalizationData = {
  companyName: string;
  sector: string | null;
  city: string | null;
  contactName: string | null;
  vacancyCount: number;
  hiringSignal: string | null;
  fieldsUsed: string[];
  warnings: string[];
  generatedAt: string;
};

export type OutreachMessage = {
  id: string;
  organizationId: string;
  campaignId: string | null;
  companyId: string;
  contactId: string | null;
  recipientName: string | null;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  status: OutreachMessageStatus;
  personalizationData: OutreachPersonalizationData;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  retryCount: number;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
};

export type OutreachEvent = {
  id: string;
  organizationId: string;
  outreachMessageId: string;
  eventType: OutreachEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RecipientSelectionResult =
  | {
      ok: true;
      recipientEmail: string;
      recipientName: string | null;
      contactId: string | null;
      source: "contact" | "company_hr" | "company_general" | "company_email" | "generic_mailbox";
      roleLabel: string | null;
    }
  | {
      ok: false;
      reason: string;
      code:
        | "missing_recipient"
        | "invalid_email"
        | "duplicate"
        | "bounced"
        | "opt_out"
        | "archived"
        | "cooldown";
    };

export type OutreachEngineContext = {
  organizationId: string;
  userId: string;
};

export type CreateOutreachDraftInput = {
  companyId: string;
  campaignId?: string | null;
  contactId?: string | null;
};

export type SendOutreachInput = {
  messageId: string;
  confirmedByUser: boolean;
  isTest?: boolean;
  testRecipientEmail?: string;
};
