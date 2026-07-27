import { z } from "zod";
import type { Company } from "@/features/companies/domain";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const listCompaniesToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  includeArchived: z.boolean().optional(),
});

export const listCompaniesTool: HireFlowTool<typeof listCompaniesToolParametersSchema> = {
  name: "listCompanies",
  description:
    "Haalt een pagina bedrijven op uit het CRM (standaard actieve bedrijven, max 50). Gebruik searchCompanies voor zoeken op naam of filters.",
  parameters: listCompaniesToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const { companies, total } = await companiesService.listCompanies(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          limit: input.limit,
          offset: input.offset,
          includeArchived: input.includeArchived,
        },
      );

      const message =
        total === 0
          ? "Geen bedrijven gevonden."
          : `${companies.length} van ${total} bedrijf${total === 1 ? "" : "en"} opgehaald.`;

      return {
        success: true,
        message,
        companies: companies as Company[],
        total,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijven konden niet worden opgehaald.";

      return {
        success: false,
        message,
        companies: [],
        total: 0,
      };
    }
  },
};
