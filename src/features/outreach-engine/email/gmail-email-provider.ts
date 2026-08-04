import "server-only";

import type {
  EmailDraftInput,
  EmailMessageStatus,
  EmailProvider,
  EmailProviderConnectionStatus,
  EmailSendResult,
  EmailSenderIdentity,
} from "@/features/outreach-engine/email/email-provider.types";
import { getOutreachSendConfig, validateSenderEmail } from "@/features/outreach-engine/domain/send-rules.config";

type GmailCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

function encodeMimeMessage(input: EmailDraftInput): string {
  const lines = [
    `From: ${input.fromName} <${input.fromEmail}>`,
    `To: ${input.toName ? `${input.toName} <${input.to}>` : input.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.bodyText).toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

export class GmailEmailProvider implements EmailProvider {
  readonly providerId = "gmail" as const;

  constructor(private readonly credentials: GmailCredentials) {}

  async verifyConnection(): Promise<EmailProviderConnectionStatus> {
    try {
      const identities = await this.listSenderIdentities();
      const config = getOutreachSendConfig();
      const match = identities.find((i) => i.email.toLowerCase() === config.senderEmail?.toLowerCase());

      return {
        connected: Boolean(match?.verified),
        provider: "gmail",
        senderEmail: match?.email ?? config.senderEmail,
        errorMessage: match ? null : "Zakelijke afzender niet gevonden in Gmail send-as identiteiten.",
      };
    } catch (error) {
      return {
        connected: false,
        provider: "gmail",
        senderEmail: getOutreachSendConfig().senderEmail,
        errorMessage: error instanceof Error ? error.message : "Gmail verbinding mislukt",
      };
    }
  }

  async listSenderIdentities(): Promise<EmailSenderIdentity[]> {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
      {
        headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Gmail sendAs API: ${response.status}`);
    }

    const data = (await response.json()) as {
      sendAs?: Array<{ sendAsEmail: string; displayName?: string; verificationStatus?: string; isDefault?: boolean }>;
    };

    return (data.sendAs ?? []).map((entry) => ({
      email: entry.sendAsEmail,
      name: entry.displayName ?? entry.sendAsEmail,
      verified: entry.verificationStatus === "accepted",
      isDefault: Boolean(entry.isDefault),
    }));
  }

  async createDraft(input: EmailDraftInput): Promise<EmailSendResult> {
    const violation = validateSenderEmail(input.fromEmail);
    if (violation) {
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: violation.message };
    }

    const raw = encodeMimeMessage(input);
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw } }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: `Gmail draft: ${text.slice(0, 200)}` };
    }

    const data = (await response.json()) as { id?: string };
    return { ok: true, providerMessageId: data.id ?? null, status: "draft", errorMessage: null };
  }

  async sendMessage(input: EmailDraftInput): Promise<EmailSendResult> {
    const violation = validateSenderEmail(input.fromEmail);
    if (violation) {
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: violation.message };
    }

    const raw = encodeMimeMessage(input);
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, providerMessageId: null, status: "failed", errorMessage: `Gmail send: ${text.slice(0, 200)}` };
    }

    const data = (await response.json()) as { id?: string };
    return { ok: true, providerMessageId: data.id ?? null, status: "sent", errorMessage: null };
  }

  async getMessageStatus(providerMessageId: string): Promise<EmailMessageStatus> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}?format=metadata`,
      { headers: { Authorization: `Bearer ${this.credentials.accessToken}` } },
    );

    if (!response.ok) {
      return { providerMessageId, status: "unknown" };
    }

    return { providerMessageId, status: "sent" };
  }

  async checkReplies(): Promise<Array<{ messageId: string; subject: string; snippet: string; from: string }>> {
    return [];
  }
}

export function createGmailProviderFromEnv(): GmailEmailProvider | null {
  const accessToken = process.env.GMAIL_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;
  return new GmailEmailProvider({ accessToken });
}
