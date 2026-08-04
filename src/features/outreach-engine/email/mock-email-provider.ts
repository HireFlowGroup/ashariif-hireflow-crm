import type {
  EmailDraftInput,
  EmailMessageStatus,
  EmailProvider,
  EmailProviderConnectionStatus,
  EmailSendResult,
  EmailSenderIdentity,
} from "@/features/outreach-engine/email/email-provider.types";
import { getOutreachSendConfig, validateSenderEmail } from "@/features/outreach-engine/domain/send-rules.config";

type MockEmailProviderOptions = {
  sentMessages?: EmailDraftInput[];
  shouldFail?: boolean;
};

/** In-memory provider for tests and DRAFT_ONLY development. */
export class MockEmailProvider implements EmailProvider {
  readonly providerId = "mock" as const;
  private readonly sent: EmailDraftInput[];
  private readonly shouldFail: boolean;

  constructor(options: MockEmailProviderOptions = {}) {
    this.sent = options.sentMessages ?? [];
    this.shouldFail = options.shouldFail ?? false;
  }

  getSentMessages(): EmailDraftInput[] {
    return [...this.sent];
  }

  async verifyConnection(): Promise<EmailProviderConnectionStatus> {
    const config = getOutreachSendConfig();
    return {
      connected: Boolean(config.senderEmail),
      provider: "mock",
      senderEmail: config.senderEmail,
      errorMessage: config.senderEmail ? null : "OUTREACH_SENDER_EMAIL niet geconfigureerd",
    };
  }

  async listSenderIdentities(): Promise<EmailSenderIdentity[]> {
    const config = getOutreachSendConfig();
    if (!config.senderEmail) return [];
    return [
      {
        email: config.senderEmail,
        name: config.senderName,
        verified: true,
        isDefault: true,
      },
    ];
  }

  async createDraft(input: EmailDraftInput): Promise<EmailSendResult> {
    const violation = validateSenderEmail(input.fromEmail);
    if (violation) {
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: violation.message };
    }
    return {
      ok: true,
      providerMessageId: `mock-draft-${input.idempotencyKey}`,
      status: "draft",
      errorMessage: null,
    };
  }

  async sendMessage(input: EmailDraftInput): Promise<EmailSendResult> {
    const violation = validateSenderEmail(input.fromEmail);
    if (violation) {
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: violation.message };
    }

    if (this.shouldFail) {
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: "Mock provider failure" };
    }

    this.sent.push(input);
    return {
      ok: true,
      providerMessageId: `mock-msg-${input.idempotencyKey}`,
      status: "sent",
      errorMessage: null,
    };
  }

  async getMessageStatus(providerMessageId: string): Promise<EmailMessageStatus> {
    return { providerMessageId, status: "sent" };
  }

  async checkReplies(): Promise<Array<{ messageId: string; subject: string; snippet: string; from: string }>> {
    return [];
  }
}
