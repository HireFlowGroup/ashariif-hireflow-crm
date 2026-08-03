import "server-only";

import OpenAI from "openai";

import { getOpenAiApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";

/**
 * Server-only OpenAI access. Do not import this module from Client Components.
 */

let openaiClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

function requireOpenAIApiKey(): string {
  const apiKey = getOpenAiApiKey()?.trim();

  if (!apiKey) {
    throw new Error(
      "OpenAI API key ontbreekt. Configureer via Settings → Providers of stel OPENAI_API_KEY in.",
    );
  }

  return apiKey;
}

/** Returns the shared OpenAI client (re-init when vault key changes). */
export function getOpenAIClient(): OpenAI {
  const apiKey = requireOpenAIApiKey();

  if (!openaiClient || cachedApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return openaiClient;
}

export function isOpenAIConfiguredForActiveOrg(): boolean {
  return Boolean(getOpenAiApiKey()?.trim());
}
