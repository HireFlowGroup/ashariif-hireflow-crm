import {
  COMMERCIAL_PIPELINE_STAGES,
  COMMERCIAL_PIPELINE_STAGE_LABELS,
  type CommercialPipelineBoard,
  type CommercialPipelineCard,
  type CommercialPipelineStage,
  type CreatePipelineCardInput,
  type MovePipelineCardInput,
} from "@/features/commercial-pipeline/domain/types";

export interface CommercialPipelineRepository {
  listCards(organizationId: string): Promise<CommercialPipelineCard[]>;
  getCard(organizationId: string, cardId: string): Promise<CommercialPipelineCard | null>;
  createCard(
    organizationId: string,
    input: CreatePipelineCardInput & {
      companyName: string;
      sector: string | null;
      city: string | null;
      contactName: string | null;
      contactEmail: string | null;
      leadScore: number | null;
    },
  ): Promise<CommercialPipelineCard>;
  moveCard(
    organizationId: string,
    cardId: string,
    input: MovePipelineCardInput,
  ): Promise<CommercialPipelineCard>;
  syncCompaniesWithoutCards(organizationId: string): Promise<number>;
}

export class CommercialPipelineRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommercialPipelineRepositoryError";
  }
}

export function buildPipelineBoard(cards: CommercialPipelineCard[]): CommercialPipelineBoard {
  const stageCounts = Object.fromEntries(
    COMMERCIAL_PIPELINE_STAGES.map((stage) => [stage, 0]),
  ) as Record<CommercialPipelineStage, number>;

  for (const card of cards) {
    stageCounts[card.stage] += 1;
  }

  const columns = COMMERCIAL_PIPELINE_STAGES.map((stage) => {
    const columnCards = cards
      .filter((c) => c.stage === stage)
      .sort((a, b) => a.position - b.position || a.companyName.localeCompare(b.companyName));

    return {
      stage,
      label: COMMERCIAL_PIPELINE_STAGE_LABELS[stage],
      count: columnCards.length,
      cards: columnCards,
    };
  });

  return {
    columns,
    totalCards: cards.length,
    stageCounts,
    generatedAt: new Date().toISOString(),
  };
}
