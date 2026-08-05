import { z } from "zod";

import { COMMERCIAL_PIPELINE_STAGES } from "@/features/commercial-pipeline/domain/types";

const stageSchema = z.enum(
  COMMERCIAL_PIPELINE_STAGES as unknown as [
    (typeof COMMERCIAL_PIPELINE_STAGES)[number],
    ...(typeof COMMERCIAL_PIPELINE_STAGES)[number][],
  ],
);

export const movePipelineCardBodySchema = z.object({
  stage: stageSchema,
  position: z.number().int().min(0).optional(),
});

export const createPipelineCardBodySchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-ID."),
  stage: stageSchema.optional(),
  sourceRunItemId: z.string().uuid().optional().nullable(),
});

export const syncPipelineBodySchema = z.object({}).optional();
