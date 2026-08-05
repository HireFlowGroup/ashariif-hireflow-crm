import "server-only";

import type {
  ReplyAnalysis,
  ReplyClassification,
  SuggestedReply,
} from "@/features/ai-recruiter/domain/types";
import { REPLY_CLASSIFICATION_LABELS } from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRepository } from "@/features/ai-recruiter/repositories/ai-recruiter.repository";
import {
  classifyReplyWithConfidence,
  getReplyFollowUpAction,
  type ReplyFollowUpAction,
} from "@/features/ai-recruiter/services/reply-classifier.service";
import {
  generateSuggestedReply,
  type ReplyResponseContext,
} from "@/features/ai-recruiter/services/reply-response-generator.service";

export type ProcessIncomingReplyInput = {
  subject: string | null;
  body: string;
  companyName: string;
  contactName?: string | null;
  originalSubject?: string | null;
  isGeneralMailbox?: boolean;
  contactEmail?: string | null;
  outreachMessageId?: string;
  runItemId?: string | null;
  persist?: boolean;
};

export type ProcessIncomingReplyResult = {
  classification: ReplyClassification;
  label: string;
  analysis: ReplyAnalysis;
  followUpAction: ReplyFollowUpAction;
  suggestedReply: SuggestedReply;
};

export async function processIncomingReply(
  repository: AiRecruiterRepository | null,
  organizationId: string | null,
  input: ProcessIncomingReplyInput,
): Promise<ProcessIncomingReplyResult> {
  const analysis = classifyReplyWithConfidence(input.subject, input.body);
  const followUpAction = getReplyFollowUpAction(analysis.classification);

  const responseContext: ReplyResponseContext = {
    companyName: input.companyName,
    contactName: input.contactName ?? null,
    originalSubject: input.originalSubject ?? null,
    replySubject: input.subject,
    replyBody: input.body,
    isGeneralMailbox: input.isGeneralMailbox,
    contactEmail: input.contactEmail,
  };

  const suggestedReply = await generateSuggestedReply(analysis.classification, responseContext);

  if (repository && organizationId && input.persist !== false && input.outreachMessageId) {
    await repository.saveReply(organizationId, {
      outreachMessageId: input.outreachMessageId,
      runItemId: input.runItemId ?? null,
      classification: analysis.classification,
      replySubject: input.subject,
      replySnippet: input.body.slice(0, 500),
      metadata: {
        confidence: analysis.confidence,
        signals: analysis.signals,
        reasoning: analysis.reasoning,
        suggestedReply,
        followUpAction,
      },
    });
  }

  return {
    classification: analysis.classification,
    label: REPLY_CLASSIFICATION_LABELS[analysis.classification],
    analysis,
    followUpAction,
    suggestedReply,
  };
}
