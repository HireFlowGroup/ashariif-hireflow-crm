export type EmailSenderIdentity = {
  email: string;
  name: string;
  verified: boolean;
  isDefault: boolean;
};

export type EmailDraftInput = {
  to: string;
  toName?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  fromEmail: string;
  fromName: string;
  idempotencyKey: string;
};

export type EmailSendResult = {
  ok: boolean;
  providerMessageId: string | null;
  status: "draft" | "sent" | "failed";
  errorMessage: string | null;
};

export type EmailMessageStatus = {
  providerMessageId: string;
  status: "sent" | "delivered" | "bounced" | "failed" | "unknown";
};

export type EmailProviderConnectionStatus = {
  connected: boolean;
  provider: "gmail" | "smtp" | "mock";
  senderEmail: string | null;
  errorMessage: string | null;
};

/** Provider-agnostic email interface for HireFlow Outreach Engine. */
export interface EmailProvider {
  readonly providerId: "gmail" | "smtp" | "mock";

  verifyConnection(): Promise<EmailProviderConnectionStatus>;

  listSenderIdentities(): Promise<EmailSenderIdentity[]>;

  createDraft(input: EmailDraftInput): Promise<EmailSendResult>;

  sendMessage(input: EmailDraftInput): Promise<EmailSendResult>;

  checkReplies?(since?: string): Promise<Array<{ messageId: string; subject: string; snippet: string; from: string }>>;
}
