import type {
  GenerateOutreachIntelligenceResult,
  OutreachIntelligenceRecord,
} from "@/features/outreach-intelligence/domain/types";
import type { OutreachIntelligenceRepository } from "@/features/outreach-intelligence/repositories/outreach-intelligence.repository";
import {
  buildOutreachAngle,
  generateOutreachDrafts,
} from "@/features/outreach-intelligence/services/outreach-draft-generator.service";
import {
  computeBestMoment,
  rankContacts,
  scoreChannels,
} from "@/features/outreach-intelligence/services/outreach-heuristics.service";
import { computeOutreachScore } from "@/features/outreach-intelligence/services/outreach-scoring.service";

export class OutreachIntelligenceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachIntelligenceServiceError";
  }
}

export class OutreachIntelligenceEngine {
  constructor(private readonly repository: OutreachIntelligenceRepository) {}

  async getCurrent(organizationId: string, companyId: string): Promise<OutreachIntelligenceRecord | null> {
    return this.repository.getCurrent(organizationId, companyId);
  }

  async generate(
    organizationId: string,
    userId: string,
    companyId: string,
  ): Promise<GenerateOutreachIntelligenceResult> {
    const context = await this.repository.loadContext(organizationId, companyId);

    if (!context) {
      throw new OutreachIntelligenceServiceError("Bedrijf niet gevonden.");
    }

    context.userId = userId;

    const rankedContacts = rankContacts(context);
    const bestContact = rankedContacts[0] ?? null;
    const channelResult = scoreChannels(context, bestContact);
    const timing = computeBestMoment(context);
    const outreachAngle = buildOutreachAngle(context);
    const scores = computeOutreachScore(context, bestContact, channelResult.scores);

    const drafts = await generateOutreachDrafts(
      context,
      bestContact,
      channelResult.recommended,
      outreachAngle,
    );

    const triggerSignal = context.signals[0] ?? null;

    const outreachId = await this.repository.upsertOutreachDraft({
      organizationId,
      companyId,
      userId,
      contactId: bestContact?.id ?? null,
      hiringSignalId: triggerSignal?.id ?? null,
      suggestedContactRole: bestContact?.jobTitle ?? suggestRole(context),
      outreachAngle,
      draftSubject: drafts.draftSubject,
      draftBody: drafts.draftBody,
      followUpScheduledAt: timing.followUpAt,
    });

    const intelligence = await this.repository.save({
      organizationId,
      companyId,
      outreachId,
      recommendedContactId: bestContact?.id ?? null,
      recommendedContactName: bestContact?.name ?? null,
      recommendedContactRole: bestContact?.jobTitle ?? suggestRole(context),
      contactScore: bestContact?.score ?? 0,
      contactReason: bestContact?.reasons.join("; ") ?? "Geen contactpersonen in database",
      recommendedChannel: channelResult.recommended,
      channelScores: channelResult.scores,
      channelReason: channelResult.reason,
      recommendedMomentAt: timing.at,
      recommendedMomentLabel: timing.label,
      timingReason: timing.reason,
      outreachScore: scores.score,
      responseProbability: scores.responseProbability,
      scoreBreakdown: scores.breakdown,
      draftSubject: drafts.draftSubject,
      draftBody: drafts.draftBody,
      followUpSubject: drafts.followUpSubject,
      followUpBody: drafts.followUpBody,
      followUpScheduledAt: timing.followUpAt,
      hiringSignalId: triggerSignal?.id ?? null,
      aiSummaryId: null,
      model: drafts.model,
    });

    return { intelligence, outreachId };
  }
}

function suggestRole(context: { vacancyCount: number }): string {
  if (context.vacancyCount > 0) return "HR Manager / Recruiter";
  return "Directeur / Eigenaar";
}
