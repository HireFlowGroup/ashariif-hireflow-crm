import { matchCandidateToVacancyTool } from "@/lib/ai/tools/candidates/match-candidate-to-vacancy";
import { archiveCompanyTool } from "@/lib/ai/tools/companies/archive-company";
import { deleteCompanyTool } from "@/lib/ai/tools/companies/delete-company";
import { createCompanyTool } from "@/lib/ai/tools/companies/create-company";
import { getCompanyTool } from "@/lib/ai/tools/companies/get-company";
import { listCompaniesTool } from "@/lib/ai/tools/companies/list-companies";
import { searchCompaniesTool } from "@/lib/ai/tools/companies/search-companies";
import { updateCompanyTool } from "@/lib/ai/tools/companies/update-company";
import { archiveVacancyTool } from "@/lib/ai/tools/vacancies/archive-vacancy";
import { createVacancyTool } from "@/lib/ai/tools/vacancies/create-vacancy";
import { getVacancyTool } from "@/lib/ai/tools/vacancies/get-vacancy";
import { listVacanciesTool } from "@/lib/ai/tools/vacancies/list-vacancies";
import { searchVacanciesTool } from "@/lib/ai/tools/vacancies/search-vacancies";
import { updateVacancyTool } from "@/lib/ai/tools/vacancies/update-vacancy";
import { getCurrentTimeTool } from "@/lib/ai/tools/system/get-current-time";
import { findSimilarCompaniesTool } from "@/lib/ai/tools/recruitment/find-similar-companies";
import { getCompaniesByAtsTool } from "@/lib/ai/tools/recruitment/get-companies-by-ats";
import { getCompaniesByVacancyRoleTool } from "@/lib/ai/tools/recruitment/get-companies-by-vacancy-role";
import { getCompaniesHiringRecruitersTool } from "@/lib/ai/tools/recruitment/get-companies-hiring-recruiters";
import { getCompaniesWithNewVacanciesTool } from "@/lib/ai/tools/recruitment/get-companies-with-new-vacancies";
import { getLeadsToCallTodayTool } from "@/lib/ai/tools/recruitment/get-leads-to-call-today";
import { getQuietClientsTool } from "@/lib/ai/tools/recruitment/get-quiet-clients";
import { getTopGrowingCompaniesTool } from "@/lib/ai/tools/recruitment/get-top-growing-companies";
import { getWarmingLeadsTool } from "@/lib/ai/tools/recruitment/get-warming-leads";
import { searchRecruitmentKnowledgeTool } from "@/lib/ai/tools/recruitment/search-recruitment-knowledge";
import type { RegisteredTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";
import {
  unwrapToZodObject,
  validateOpenAIToolParameterSchema,
  zodObjectToJsonSchema,
} from "@/lib/ai/tools/schemas";
import type { FunctionTool } from "openai/resources/responses/responses";

const toolRegistry = new Map<string, RegisteredTool>();

function registerTool(tool: RegisteredTool): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered.`);
  }

  const strict = tool.strict ?? true;
  const objectSchema = unwrapToZodObject(tool.parameters);

  if (!objectSchema) {
    throw new Error(`Tool "${tool.name}" parameters must resolve to a Zod object schema.`);
  }

  const parameters = zodObjectToJsonSchema(objectSchema, { strict });
  validateOpenAIToolParameterSchema(tool.name, parameters, strict);

  toolRegistry.set(tool.name, tool);
}

function registerBuiltInTools(): void {
  registerTool(getCurrentTimeTool);
  registerTool(createCompanyTool);
  registerTool(listCompaniesTool);
  registerTool(searchCompaniesTool);
  registerTool(getCompanyTool);
  registerTool(updateCompanyTool);
  registerTool(archiveCompanyTool);
  registerTool(deleteCompanyTool);
  registerTool(createVacancyTool);
  registerTool(listVacanciesTool);
  registerTool(searchVacanciesTool);
  registerTool(getVacancyTool);
  registerTool(updateVacancyTool);
  registerTool(archiveVacancyTool);
  registerTool(matchCandidateToVacancyTool);
  registerTool(getTopGrowingCompaniesTool);
  registerTool(getCompaniesWithNewVacanciesTool);
  registerTool(getCompaniesHiringRecruitersTool);
  registerTool(getLeadsToCallTodayTool);
  registerTool(getWarmingLeadsTool);
  registerTool(getQuietClientsTool);
  registerTool(getCompaniesByAtsTool);
  registerTool(getCompaniesByVacancyRoleTool);
  registerTool(findSimilarCompaniesTool);
  registerTool(searchRecruitmentKnowledgeTool);
}

registerBuiltInTools();

export function getRegisteredTools(): RegisteredTool[] {
  return [...toolRegistry.values()];
}

export function getToolByName(name: string): RegisteredTool | undefined {
  return toolRegistry.get(name);
}

export function getOpenAIToolDefinitions(): FunctionTool[] {
  return getRegisteredTools().map((tool) => toOpenAIFunctionTool(tool));
}

function toOpenAIFunctionTool(tool: RegisteredTool): FunctionTool {
  const strict = tool.strict ?? true;
  const objectSchema = unwrapToZodObject(tool.parameters);

  const parameters =
    objectSchema !== null
      ? zodObjectToJsonSchema(objectSchema, { strict })
      : {
          type: "object" as const,
          properties: {},
          additionalProperties: false as const,
        };

  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters,
    strict,
  };
}

export type { ToolExecutionContext, ToolResult };
