import { z } from "zod";

import { createRecruitmentRagService } from "@/features/recruitment-rag";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const searchRecruitmentKnowledgeToolParametersSchema = z.object({
  query: z.string().min(1).max(500),
  matchCount: z.number().int().min(1).max(25).optional(),
});

export const searchRecruitmentKnowledgeTool: HireFlowTool<
  typeof searchRecruitmentKnowledgeToolParametersSchema
> = {
  name: "searchRecruitmentKnowledge",
  description:
    "Zoekt semantisch in de HireFlow kennisbank (RAG) over bedrijven, vacatures, hiring signals en AI-samenvattingen. Gebruik als aanvulling op gestructureerde tools of voor brede contextvragen. Retourneert alleen data uit de geïndexeerde database — geen externe bronnen.",
  parameters: searchRecruitmentKnowledgeToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentRagService();
      const result = await service.searchKnowledge(
        context.organizationId,
        input.query,
        input.matchCount ?? 10,
      );

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen relevante kennis gevonden in de HireFlow database voor deze zoekopdracht.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} relevante kennisfragmenten gevonden in de database.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Kennisbank doorzoeken mislukt.",
        total: 0,
      };
    }
  },
};
