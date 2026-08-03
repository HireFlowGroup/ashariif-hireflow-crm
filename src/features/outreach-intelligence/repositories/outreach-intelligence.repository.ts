import type {
  GenerateOutreachIntelligenceResult,
  OutreachIntelligenceContext,
  OutreachIntelligenceRecord,
} from "@/features/outreach-intelligence/domain/types";

export class OutreachIntelligenceRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachIntelligenceRepositoryError";
  }
}

export interface OutreachIntelligenceRepository {
  loadContext(organizationId: string, companyId: string): Promise<OutreachIntelligenceContext | null>;

  getCurrent(organizationId: string, companyId: string): Promise<OutreachIntelligenceRecord | null>;

  save(
    record: Omit<OutreachIntelligenceRecord, "id" | "computedAt"> & { id?: string },
  ): Promise<OutreachIntelligenceRecord>;

  upsertOutreachDraft(input: {
    organizationId: string;
    companyId: string;
    userId: string;
    contactId: string | null;
    hiringSignalId: string | null;
    suggestedContactRole: string | null;
    outreachAngle: string;
    draftSubject: string;
    draftBody: string;
    followUpScheduledAt: string;
  }): Promise<string | null>;
}

export interface OutreachIntelligenceEngine {
  generate(organizationId: string, userId: string, companyId: string): Promise<GenerateOutreachIntelligenceResult>;
}
