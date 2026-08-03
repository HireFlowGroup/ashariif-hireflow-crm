/**
 * @deprecated Import from `@/lib/ai/client` or `@/platform/config/env`.
 */
export { getOpenAIClient } from "@/lib/ai/client";
export { isOpenAIConfigured } from "@/platform/config/env";

/** @deprecated Use HIREFLOW_SYSTEM_PROMPT from `@/lib/ai/prompts`. */
export const openAIRecruitingSystemPrompt = `You are HireFlow AI, an expert recruitment assistant embedded in a CRM.
Help recruiters with candidate screening guidance, job description improvements, interview questions,
and pipeline next steps. Be concise, actionable, and professional. Do not invent candidate or company data.`;
