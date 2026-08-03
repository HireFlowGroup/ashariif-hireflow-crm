import type {
  OutreachGeneratorContent,
  OutreachGeneratorRecord,
  OutreachWritingStyle,
} from "@/features/outreach-generator/domain/generator.types";

export class OutreachGeneratorRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachGeneratorRepositoryError";
  }
}

export type SaveOutreachGenerationInput = {
  organizationId: string;
  companyId: string;
  userId: string;
  writingStyle: OutreachWritingStyle;
  contactId: string | null;
  contactName: string | null;
  primarySignalId: string | null;
  content: OutreachGeneratorContent;
  referencedSignalIds: string[];
  model: string | null;
  modelVersion: string;
};

export interface OutreachGeneratorRepository {
  getCurrent(
    organizationId: string,
    companyId: string,
    writingStyle: OutreachWritingStyle,
  ): Promise<OutreachGeneratorRecord | null>;

  listCurrentByCompany(
    organizationId: string,
    companyId: string,
  ): Promise<OutreachGeneratorRecord[]>;

  save(input: SaveOutreachGenerationInput): Promise<OutreachGeneratorRecord>;
}
