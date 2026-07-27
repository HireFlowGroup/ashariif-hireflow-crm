import { z } from "zod";
import { toCompanyId } from "@/features/companies/domain";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export const archiveCompanyToolParametersSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id."),
  reason: z.preprocess(
    emptyStringToUndefined,
    z.string().max(500, "Reden is te lang.").optional(),
  ),
});

export const archiveCompanyTool: HireFlowTool<typeof archiveCompanyToolParametersSchema> = {
  name: "archiveCompany",
  description:
    "Archiveert een bedrijf in het CRM (status inactief). Verwijdert geen data. Gebruik searchCompanies om het juiste companyId te vinden.",
  parameters: archiveCompanyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const company = await companiesService.archiveCompany(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toCompanyId(input.companyId),
        { reason: input.reason },
      );

      return {
        success: true,
        message: "Bedrijf is succesvol gearchiveerd.",
        company,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijf kon niet worden gearchiveerd.";

      return {
        success: false,
        message,
      };
    }
  },
};
