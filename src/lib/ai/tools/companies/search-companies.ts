import { z } from "zod";
import type { Company } from "@/features/companies/domain";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const searchCompaniesToolParametersSchema = z.object({
  query: z.string().max(200, "Zoekterm is te lang.").optional(),
  city: z.string().max(120, "Plaats is te lang.").optional(),
  sector: z.string().max(120, "Sector is te lang.").optional(),
  archived: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const searchCompaniesTool: HireFlowTool<typeof searchCompaniesToolParametersSchema> = {
  name: "searchCompanies",
  description:
    "Zoekt bedrijven in het CRM van de huidige organisatie op naam, website, sector of status. Gebruik dit om bestaande bedrijven te vinden voordat je nieuwe aanmaakt.",
  parameters: searchCompaniesToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const companies = await companiesService.searchCompanies(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          query: input.query,
          city: input.city,
          sector: input.sector,
          archived: input.archived,
          limit: input.limit ?? 20,
        },
      );

      const message =
        companies.length === 0
          ? "Geen bedrijven gevonden voor deze zoekopdracht."
          : `${companies.length} bedrijf${companies.length === 1 ? "" : "en"} gevonden.`;

      return {
        success: true,
        message,
        companies: companies as Company[],
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijven konden niet worden gezocht.";

      return {
        success: false,
        message,
        companies: [],
      };
    }
  },
};
