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

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

async function sendViaSmtp(input: EmailDraftInput, smtp: SmtpConfig): Promise<EmailSendResult> {
  const violation = validateSenderEmail(input.fromEmail);
  if (violation) {
    return { ok: false, providerMessageId: null, status: "failed", errorMessage: violation.message };
  }

  try {
    // Lightweight SMTP send via raw TLS socket (Strato-compatible)
    const { connect } = await import("node:tls");
    const { connect: netConnect } = await import("node:net");

    const messageId = `<${input.idempotencyKey}@${input.fromEmail.split("@")[1] ?? "hireflow.local"}>`;
    const boundary = `hireflow-${Date.now()}`;

    const body = [
      `From: ${input.fromName} <${input.fromEmail}>`,
      `To: ${input.toName ? `${input.toName} <${input.to}>` : input.to}`,
      `Subject: ${input.subject}`,
      `Message-ID: ${messageId}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      input.bodyText,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    await new Promise<void>((resolve, reject) => {
      const socket = smtp.secure
        ? connect(smtp.port, smtp.host, { rejectUnauthorized: true })
        : netConnect(smtp.port, smtp.host);

      let step = 0;
      let buffer = "";

      const commands = [
        `EHLO hireflow.local`,
        `AUTH LOGIN`,
        Buffer.from(smtp.user).toString("base64"),
        Buffer.from(smtp.pass).toString("base64"),
        `MAIL FROM:<${input.fromEmail}>`,
        `RCPT TO:<${input.to}>`,
        `DATA`,
        body,
        `.`,
        `QUIT`,
      ];

      const sendNext = () => {
        if (step >= commands.length) return;
        const cmd = commands[step]!;
        step += 1;
        if (cmd === body) {
          socket.write(body + "\r\n.\r\n");
        } else {
          socket.write(cmd + "\r\n");
        }
      };

      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        if (/^\d{3} /m.test(buffer.slice(-6))) {
          buffer = "";
          if (step < commands.length) sendNext();
          else resolve();
        }
      });

      socket.on("error", reject);
      socket.on("secureConnect", sendNext);
      socket.on("connect", () => {
        if (!smtp.secure) sendNext();
      });
    });

    return { ok: true, providerMessageId: messageId, status: "sent", errorMessage: null };
  } catch (error) {
    return {
      ok: false,
      providerMessageId: null,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "SMTP verzending mislukt",
    };
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly providerId = "smtp" as const;

  constructor(private readonly smtp: SmtpConfig) {}

  async verifyConnection(): Promise<EmailProviderConnectionStatus> {
    const config = getOutreachSendConfig();
    return {
      connected: Boolean(this.smtp.host && this.smtp.user),
      provider: "smtp",
      senderEmail: config.senderEmail ?? this.smtp.user,
      errorMessage: this.smtp.host ? null : "SMTP niet geconfigureerd",
    };
  }

  async listSenderIdentities(): Promise<EmailSenderIdentity[]> {
    const config = getOutreachSendConfig();
    const email = config.senderEmail ?? this.smtp.user;
    return [{ email, name: config.senderName, verified: true, isDefault: true }];
  }

  async createDraft(input: EmailDraftInput): Promise<EmailSendResult> {
    return {
      ok: true,
      providerMessageId: `smtp-draft-${input.idempotencyKey}`,
      status: "draft",
      errorMessage: null,
    };
  }

  async sendMessage(input: EmailDraftInput): Promise<EmailSendResult> {
    return sendViaSmtp(input, this.smtp);
  }

  async getMessageStatus(providerMessageId: string): Promise<EmailMessageStatus> {
    return { providerMessageId, status: "sent" };
  }

  async checkReplies(): Promise<Array<{ messageId: string; subject: string; snippet: string; from: string }>> {
    return [];
  }
}

export function createSmtpProviderFromEnv(): SmtpEmailProvider | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  return new SmtpEmailProvider({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "465", 10),
    secure: process.env.SMTP_SECURE !== "false",
    user,
    pass,
  });
}
