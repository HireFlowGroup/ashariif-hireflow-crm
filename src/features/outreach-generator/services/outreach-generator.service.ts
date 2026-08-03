import {
  OUTREACH_WRITING_STYLES,
  type OutreachGeneratorRecord,
  type OutreachGeneratorResponse,
  type OutreachWritingStyle,
  parseWritingStyle,
} from "@/features/outreach-generator/domain/generator.types";
import type { OutreachGeneratorRepository } from "@/features/outreach-generator/repositories/outreach-generator.repository";
import { OUTREACH_GENERATOR_MODEL_VERSION } from "@/features/outreach-generator/repositories/supabase-outreach-generator.repository";
import { generateOutreachContent } from "@/features/outreach-generator/services/outreach-content-generator.service";
import type { OutreachIntelligenceRepository } from "@/features/outreach-intelligence/repositories/outreach-intelligence.repository";
import { rankContacts } from "@/features/outreach-intelligence/services/outreach-heuristics.service";
import type { AuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export class OutreachGeneratorServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachGeneratorServiceError";
  }
}

export class OutreachGeneratorService {
  constructor(
    private readonly generatorRepository: OutreachGeneratorRepository,
    private readonly contextRepository: OutreachIntelligenceRepository,
  ) {}

  async getGeneration(
    context: AuthenticatedServiceContext,
    companyId: string,
    style?: OutreachWritingStyle,
  ): Promise<OutreachGeneratorResponse> {
    const writingStyle = style ?? "consultative";
    const generation = await this.generatorRepository.getCurrent(
      context.organizationId,
      companyId,
      writingStyle,
    );

    return {
      generation,
      availableStyles: [...OUTREACH_WRITING_STYLES],
    };
  }

  async generate(
    context: AuthenticatedServiceContext,
    companyId: string,
    options?: {
      style?: OutreachWritingStyle;
      contactId?: string | null;
      force?: boolean;
    },
  ): Promise<OutreachGeneratorRecord> {
    const writingStyle = options?.style ?? "consultative";
    const outreachContext = await this.contextRepository.loadContext(
      context.organizationId,
      companyId,
    );

    if (!outreachContext) {
      throw new OutreachGeneratorServiceError("Bedrijf niet gevonden.");
    }

    if (!options?.force) {
      const existing = await this.generatorRepository.getCurrent(
        context.organizationId,
        companyId,
        writingStyle,
      );

      if (existing) {
        return existing;
      }
    }

    const rankedContacts = rankContacts(outreachContext);
    const selectedContact =
      (options?.contactId
        ? rankedContacts.find((contact) => contact.id === options.contactId)
        : rankedContacts[0]) ?? null;

    const generated = await generateOutreachContent(
      outreachContext,
      selectedContact?.name ?? null,
      writingStyle,
    );

    return this.generatorRepository.save({
      organizationId: context.organizationId,
      companyId,
      userId: context.userId,
      writingStyle,
      contactId: selectedContact?.id ?? null,
      contactName: selectedContact?.name ?? null,
      primarySignalId: generated.primarySignalId,
      content: generated.content,
      referencedSignalIds: generated.referencedSignalIds,
      model: generated.model,
      modelVersion: OUTREACH_GENERATOR_MODEL_VERSION,
    });
  }
}

export function parseOutreachGeneratorStyleParam(value: string | null): OutreachWritingStyle {
  return parseWritingStyle(value);
}
