import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const { OPENAI_API_KEY } = getServerEnv();

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  return openaiClient;
}

export const openAIRecruitingSystemPrompt = `You are HireFlow AI, an expert recruitment assistant embedded in a CRM.
Help recruiters with candidate screening guidance, job description improvements, interview questions,
and pipeline next steps. Be concise, actionable, and professional. Do not invent candidate or company data.`;
