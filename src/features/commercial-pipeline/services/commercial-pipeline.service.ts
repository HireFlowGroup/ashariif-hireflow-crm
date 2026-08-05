import {
  buildPipelineBoard,
  type CommercialPipelineRepository,
} from "@/features/commercial-pipeline/repositories/commercial-pipeline.repository";
import type {
  CommercialPipelineBoard,
  CommercialPipelineCard,
  CreatePipelineCardInput,
  MovePipelineCardInput,
} from "@/features/commercial-pipeline/domain/types";
import { CommercialPipelineServiceError } from "@/features/commercial-pipeline/services/errors";

export class CommercialPipelineService {
  constructor(
    private readonly repository: CommercialPipelineRepository,
    private readonly loadCompany: (
      organizationId: string,
      companyId: string,
    ) => Promise<{
      id: string;
      name: string;
      sector: string | null;
      city: string | null;
      contactName: string | null;
      contactEmail: string | null;
      leadScore: number | null;
    } | null>,
  ) {}

  async getBoard(organizationId: string): Promise<CommercialPipelineBoard> {
    const cards = await this.repository.listCards(organizationId);
    return buildPipelineBoard(cards);
  }

  async moveCard(
    organizationId: string,
    cardId: string,
    input: MovePipelineCardInput,
  ): Promise<CommercialPipelineCard> {
    return this.repository.moveCard(organizationId, cardId, input);
  }

  async createCard(
    organizationId: string,
    input: CreatePipelineCardInput,
  ): Promise<CommercialPipelineCard> {
    const company = await this.loadCompany(organizationId, input.companyId);
    if (!company) {
      throw new CommercialPipelineServiceError("Bedrijf niet gevonden.");
    }

    return this.repository.createCard(organizationId, {
      ...input,
      companyName: company.name,
      sector: company.sector,
      city: company.city,
      contactName: company.contactName,
      contactEmail: company.contactEmail,
      leadScore: company.leadScore,
    });
  }

  async syncCompanies(organizationId: string): Promise<{ imported: number; board: CommercialPipelineBoard }> {
    const imported = await this.repository.syncCompaniesWithoutCards(organizationId);
    const board = await this.getBoard(organizationId);
    return { imported, board };
  }
}
