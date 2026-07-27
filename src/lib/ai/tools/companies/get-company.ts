import { z } from "zod";
import { toCompanyId } from "@/features/companies/domain";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const getCompanyToolParametersSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id."),
});

export const getCompanyTool: HireFlowTool<typeof getCompanyToolParametersSchema> = {
  name: "getCompany",
  description:
    "Haalt één bedrijf op uit het CRM op basis van companyId. Gebruik searchCompanies om het juiste id te vinden.",
  parameters: getCompanyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const company = await companiesService.getCompany(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toCompanyId(input.companyId),
      );

      return {
        success: true,
        message: "Bedrijf is opgehaald.",
        company,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijf kon niet worden opgehaald.";

      return {
        success: false,
        message,
      };
    }
  },
};
