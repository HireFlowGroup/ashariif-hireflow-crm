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

export const deleteCompanyToolParametersSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id."),
  reason: z.preprocess(
    emptyStringToUndefined,
    z.string().max(500, "Reden is te lang.").optional(),
  ),
});

export const deleteCompanyTool: HireFlowTool<typeof deleteCompanyToolParametersSchema> = {
  name: "deleteCompany",
  description:
    "Verwijdert een bedrijf soft uit het CRM (zet status op inactief; geen hard delete). Gebruik searchCompanies om het juiste companyId te vinden.",
  parameters: deleteCompanyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const company = await companiesService.deleteCompany(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toCompanyId(input.companyId),
        { reason: input.reason },
      );

      return {
        success: true,
        message: "Bedrijf is soft verwijderd (status inactief).",
        company,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijf kon niet worden verwijderd.";

      return {
        success: false,
        message,
      };
    }
  },
};
