export const COMMERCIAL_PIPELINE_STAGES = [
  "nieuw",
  "geanalyseerd",
  "mail_klaar",
  "mail_verzonden",
  "reactie_ontvangen",
  "interesse",
  "intake_gepland",
  "vacature_ontvangen",
  "kandidaten_zoeken",
  "voorstellen_gedaan",
  "interview",
  "plaatsing",
  "verloren",
] as const;

export type CommercialPipelineStage = (typeof COMMERCIAL_PIPELINE_STAGES)[number];

export const COMMERCIAL_PIPELINE_STAGE_LABELS: Record<CommercialPipelineStage, string> = {
  nieuw: "Nieuw",
  geanalyseerd: "Geanalyseerd",
  mail_klaar: "Mail klaar",
  mail_verzonden: "Mail verzonden",
  reactie_ontvangen: "Reactie ontvangen",
  interesse: "Interesse",
  intake_gepland: "Intake gepland",
  vacature_ontvangen: "Vacature ontvangen",
  kandidaten_zoeken: "Kandidaten zoeken",
  voorstellen_gedaan: "Voorstellen gedaan",
  interview: "Interview",
  plaatsing: "Plaatsing",
  verloren: "Verloren",
};

export const ACTIVE_PIPELINE_STAGES = COMMERCIAL_PIPELINE_STAGES.filter(
  (stage) => stage !== "verloren",
);

export function isCommercialPipelineStage(value: string): value is CommercialPipelineStage {
  return (COMMERCIAL_PIPELINE_STAGES as readonly string[]).includes(value);
}

export type CommercialPipelineCard = {
  id: string;
  organizationId: string;
  companyId: string;
  stage: CommercialPipelineStage;
  position: number;
  companyName: string;
  sector: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  leadScore: number | null;
  dealValue: number | null;
  notes: string | null;
  sourceRunItemId: string | null;
  lostReason: string | null;
  movedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CommercialPipelineColumn = {
  stage: CommercialPipelineStage;
  label: string;
  count: number;
  cards: CommercialPipelineCard[];
};

export type CommercialPipelineBoard = {
  columns: CommercialPipelineColumn[];
  totalCards: number;
  stageCounts: Record<CommercialPipelineStage, number>;
  generatedAt: string;
};

export type MovePipelineCardInput = {
  stage: CommercialPipelineStage;
  position?: number;
};

export type CreatePipelineCardInput = {
  companyId: string;
  stage?: CommercialPipelineStage;
  sourceRunItemId?: string | null;
};
