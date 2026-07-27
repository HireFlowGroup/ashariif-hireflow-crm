import OpenAI from "openai";

/**
 * Server-only OpenAI access. Do not import this module from Client Components.
 */

let openaiClient: OpenAI | null = null;

function requireOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY ontbreekt. Stel deze omgevingsvariabele in op de server (bijv. .env.local).",
    );
  }

  return apiKey;
}

/** Returns the shared OpenAI client (initialized once per process). */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: requireOpenAIApiKey() });
  }

  return openaiClient;
}
