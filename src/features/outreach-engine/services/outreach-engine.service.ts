import "server-only";

import { createHash } from "node:crypto";

import type { CompaniesService } from "@/features/companies/services/companies.service";
import type { CompanyId } from "@/features/companies/domain";
import { toCompanyId } from "@/features/companies/domain";
import type {
  CreateOutreachDraftInput,
  OutreachEngineContext,
  OutreachMessage,
  SendOutreachInput,
} from "@/features/outreach-engine/domain/types";
import {
  computeRetryDelayMs,
  getOutreachSendConfig,
  validateDraftOnlyMode,
  validateKillSwitch,
  validateSendWindow,
  validateSenderEmail,
} from "@/features/outreach-engine/domain/send-rules.config";
import type { EmailProvider } from "@/features/outreach-engine/email/email-provider.types";
import type { OutreachEngineRepository } from "@/features/outreach-engine/repositories/outreach-engine.repository";
import { generatePersonalizedEmail } from "@/features/outreach-engine/services/personalization.service";
import {
  findDuplicateRecipient,
  selectRecipient,
  type OutreachContactRecord,
} from "@/features/outreach-engine/services/recipient-selection.service";
import type { SupabaseClient } from "@supabase/supabase-js";

export class OutreachEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "OutreachEngineError";
  }
}

export class OutreachEngine {
  constructor(
    private readonly repository: OutreachEngineRepository,
    private readonly companiesService: CompaniesService,
    private readonly emailProvider: EmailProvider,
    private readonly contactsClient: SupabaseClient,
  ) {}

  async createDraft(
    context: OutreachEngineContext,
    input: CreateOutreachDraftInput,
  ): Promise<OutreachMessage> {
    const company = await this.companiesService.getCompany(
      context,
      toCompanyId(input.companyId) as CompanyId,
    );

    const contacts = await this.loadContacts(context.organizationId, input.companyId);
    const suppressed = await this.repository.getSuppressedEmails(context.organizationId);
    const bounced = await this.repository.getBouncedEmails(context.organizationId);
    const recentCompanies = await this.repository.getRecentlyContactedCompanyIds(
      context.organizationId,
      getOutreachSendConfig().companyCooldownDays,
    );
    const activeEmails = await this.repository.getActiveRecipientEmails(context.organizationId);

    const recipient = selectRecipient({
      company: { ...company, outreachOptOut: (company as { outreachOptOut?: boolean }).outreachOptOut ?? false },
      contacts,
      suppressedEmails: suppressed,
      bouncedEmails: bounced,
      recentlyContactedCompanyIds: recentCompanies,
    });

    if (!recipient.ok) {
      const message = await this.repository.createMessage(context.organizationId, context.userId, {
        campaignId: input.campaignId ?? null,
        companyId: input.companyId,
        contactId: input.contactId ?? null,
        recipientName: null,
        recipientEmail: "blocked@local.invalid",
        subject: "",
        bodyText: "",
        status: "blocked_missing_recipient",
        personalizationData: { reason: recipient.reason, code: recipient.code },
        idempotencyKey: buildIdempotencyKey(input.companyId, "blocked"),
        provider: this.emailProvider.providerId,
      });

      await this.repository.logEvent(context.organizationId, message.id, "blocked", {
        reason: recipient.reason,
        code: recipient.code,
      });

      throw new OutreachEngineError(recipient.reason, recipient.code);
    }

    if (findDuplicateRecipient(recipient.recipientEmail, activeEmails)) {
      throw new OutreachEngineError("Dit e-mailadres heeft al een actief outreach-bericht.", "duplicate");
    }

    const hiringSignal =
      company.hiringSignals[0]?.description ??
      (company.vacancyCount > 0 ? `${company.vacancyCount} vacature(s)` : null);

    const personalized = await generatePersonalizedEmail({
      company,
      recipientName: recipient.recipientName,
      hiringSignal,
    });

    const idempotencyKey = buildIdempotencyKey(input.companyId, recipient.recipientEmail);

    const message = await this.repository.createMessage(context.organizationId, context.userId, {
      campaignId: input.campaignId ?? null,
      companyId: input.companyId,
      contactId: recipient.contactId,
      recipientName: recipient.recipientName,
      recipientEmail: recipient.recipientEmail,
      subject: personalized.subject,
      bodyText: personalized.bodyText,
      status: "pending_approval",
      personalizationData: personalized.personalization,
      idempotencyKey,
      provider: this.emailProvider.providerId,
    });

    await this.repository.logEvent(context.organizationId, message.id, "draft_created", {
      recipientSource: recipient.source,
      roleLabel: recipient.roleLabel,
    });

    return message;
  }

  async approveMessage(context: OutreachEngineContext, messageId: string): Promise<OutreachMessage> {
    const message = await this.requireMessage(context, messageId);

    if (!["draft", "pending_approval"].includes(message.status)) {
      throw new OutreachEngineError("Alleen concepten kunnen worden goedgekeurd.", "invalid_status");
    }

    const updated = await this.repository.updateMessage(context.organizationId, messageId, {
      status: "approved",
      approvedBy: context.userId,
      approvedAt: new Date().toISOString(),
    });

    await this.repository.logEvent(context.organizationId, messageId, "approved", {
      approvedBy: context.userId,
    });

    return updated;
  }

  async rejectMessage(context: OutreachEngineContext, messageId: string): Promise<OutreachMessage> {
    const message = await this.requireMessage(context, messageId);
    const updated = await this.repository.updateMessage(context.organizationId, messageId, {
      status: "cancelled",
    });
    await this.repository.logEvent(context.organizationId, messageId, "rejected", {
      previousStatus: message.status,
    });
    return updated;
  }

  async updateDraft(
    context: OutreachEngineContext,
    messageId: string,
    updates: { subject?: string; bodyText?: string },
  ): Promise<OutreachMessage> {
    const message = await this.requireMessage(context, messageId);

    if (message.status === "sent") {
      throw new OutreachEngineError("Verzonden berichten kunnen niet worden bewerkt.", "already_sent");
    }

    const updated = await this.repository.updateMessage(context.organizationId, messageId, updates);
    await this.repository.logEvent(context.organizationId, messageId, "edited", {
      fields: Object.keys(updates),
    });
    return updated;
  }

  async sendMessage(context: OutreachEngineContext, input: SendOutreachInput): Promise<OutreachMessage> {
    const message = await this.requireMessage(context, input.messageId);

    if (message.status === "sent") {
      throw new OutreachEngineError("Bericht is al verzonden.", "already_sent");
    }

    const isTest = input.isTest === true;

    if (!isTest && message.status !== "approved") {
      throw new OutreachEngineError("Bericht moet eerst worden goedgekeurd.", "not_approved");
    }

    if (!["approved", "pending_approval", "draft"].includes(message.status)) {
      throw new OutreachEngineError(`Verzending niet toegestaan vanuit status ${message.status}.`, "invalid_status");
    }

    const config = getOutreachSendConfig();

    for (const check of [
      validateKillSwitch(),
      validateDraftOnlyMode(input.confirmedByUser, isTest),
      isTest ? null : validateSendWindow(),
    ]) {
      if (check) throw new OutreachEngineError(check.message, check.code);
    }

    const sentToday = await this.repository.countSentToday(context.organizationId);
    if (!isTest && sentToday >= config.dailyLimit) {
      throw new OutreachEngineError(`Daglimiet bereikt (${config.dailyLimit}).`, "daily_limit");
    }

    const fromEmail = config.senderEmail;
    if (!fromEmail) {
      throw new OutreachEngineError("OUTREACH_SENDER_EMAIL niet geconfigureerd.", "missing_sender");
    }

    const senderViolation = validateSenderEmail(fromEmail);
    if (senderViolation) {
      throw new OutreachEngineError(senderViolation.message, senderViolation.code);
    }

    const toEmail = isTest ? input.testRecipientEmail : message.recipientEmail;
    if (!toEmail) {
      throw new OutreachEngineError("Geen ontvanger opgegeven.", "missing_recipient");
    }

    if (isTest && !input.testRecipientEmail) {
      throw new OutreachEngineError("Testmail vereist testRecipientEmail.", "missing_test_recipient");
    }

    await this.repository.updateMessage(context.organizationId, message.id, { status: "sending" });
    await this.repository.logEvent(context.organizationId, message.id, "send_attempt", {
      isTest,
      to: isTest ? maskEmail(toEmail) : maskEmail(message.recipientEmail),
      provider: this.emailProvider.providerId,
    });

    const result = await this.emailProvider.sendMessage({
      to: toEmail,
      toName: isTest ? "Test" : message.recipientName,
      subject: isTest ? `[TEST] ${message.subject}` : message.subject,
      bodyText: message.bodyText,
      fromEmail,
      fromName: config.senderName,
      idempotencyKey: message.idempotencyKey,
    });

    if (!result.ok) {
      const retryCount = message.retryCount + 1;
      const canRetry = retryCount <= config.maxRetries;

      await this.repository.updateMessage(context.organizationId, message.id, {
        status: canRetry ? "approved" : "failed",
        errorMessage: result.errorMessage ?? undefined,
        retryCount,
      });

      await this.repository.logEvent(context.organizationId, message.id, "failed", {
        error: result.errorMessage,
        retryCount,
        retryDelayMs: canRetry ? computeRetryDelayMs(retryCount) : null,
      });

      throw new OutreachEngineError(result.errorMessage ?? "Verzending mislukt.", "send_failed");
    }

    const updated = await this.repository.updateMessage(context.organizationId, message.id, {
      status: "sent",
      sentAt: new Date().toISOString(),
      provider: this.emailProvider.providerId,
      providerMessageId: result.providerMessageId ?? undefined,
      errorMessage: undefined,
    });

    await this.repository.logEvent(context.organizationId, message.id, isTest ? "test_sent" : "sent", {
      providerMessageId: result.providerMessageId,
    });

    if (!isTest) {
      await this.contactsClient
        .from("companies")
        .update({ outreach_status: "sent", updated_at: new Date().toISOString() })
        .eq("id", message.companyId)
        .eq("organization_id", context.organizationId);
    }

    return updated;
  }

  async optOut(
    context: OutreachEngineContext,
    input: { email: string; companyId?: string; contactId?: string; reason?: string },
  ): Promise<void> {
    await this.repository.addSuppression(
      context.organizationId,
      input.email,
      input.reason ?? "opt_out",
      context.userId,
      input.companyId,
      input.contactId,
    );

    if (input.companyId) {
      await this.contactsClient
        .from("companies")
        .update({ outreach_opt_out: true })
        .eq("id", input.companyId)
        .eq("organization_id", context.organizationId);
    }

    if (input.contactId) {
      await this.contactsClient
        .from("contacts")
        .update({ outreach_opt_out: true })
        .eq("id", input.contactId)
        .eq("organization_id", context.organizationId);
    }
  }

  async listMessages(
    context: OutreachEngineContext,
    status?: OutreachMessage["status"][],
  ): Promise<OutreachMessage[]> {
    return this.repository.listMessages(context.organizationId, { status, limit: 100 });
  }

  async getMessage(context: OutreachEngineContext, messageId: string): Promise<OutreachMessage | null> {
    return this.repository.getMessage(context.organizationId, messageId);
  }

  private async requireMessage(context: OutreachEngineContext, messageId: string): Promise<OutreachMessage> {
    const message = await this.repository.getMessage(context.organizationId, messageId);
    if (!message) throw new OutreachEngineError("Outreach-bericht niet gevonden.", "not_found");
    return message;
  }

  private async loadContacts(organizationId: string, companyId: string): Promise<OutreachContactRecord[]> {
    const { data } = await this.contactsClient
      .from("contacts")
      .select("id, first_name, last_name, job_title, email, confidence, outreach_opt_out")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId);

    return (data ?? []).map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      jobTitle: (row.job_title as string) ?? null,
      email: (row.email as string) ?? null,
      confidence: (row.confidence as number) ?? null,
      outreachOptOut: Boolean(row.outreach_opt_out),
    }));
  }
}

function buildIdempotencyKey(companyId: string, recipient: string): string {
  return createHash("sha256").update(`${companyId}:${recipient}:${new Date().toISOString().slice(0, 10)}`).digest("hex").slice(0, 32);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function createOutreachEngine(
  repository: OutreachEngineRepository,
  companiesService: CompaniesService,
  emailProvider: EmailProvider,
  contactsClient: SupabaseClient,
): OutreachEngine {
  return new OutreachEngine(repository, companiesService, emailProvider, contactsClient);
}
