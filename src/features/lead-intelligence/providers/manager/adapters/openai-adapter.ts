import type { ProviderAdapter } from "@/features/lead-intelligence/providers/manager/provider-adapter.types";
import type { ManagedProviderDefinition, ProviderTestResult } from "@/features/lead-intelligence/providers/manager/types";
import { getOpenAiApiKey } from "@/features/lead-intelligence/providers/manager/provider-env";

export function createOpenAiAdapter(definition: ManagedProviderDefinition): ProviderAdapter {
  return {
    definition,
    async test(): Promise<ProviderTestResult> {
      const started = Date.now();
      const apiKey = getOpenAiApiKey();

      if (!apiKey) {
        return {
          providerId: definition.id,
          success: false,
          durationMs: 0,
          responseSize: 0,
          message: "OpenAI API key ontbreekt",
          error: "Geen API key",
        };
      }

      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(definition.timeoutMs),
        });

        const body = await response.text();

        if (!response.ok) {
          throw new Error(`OpenAI HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        return {
          providerId: definition.id,
          success: true,
          durationMs: Date.now() - started,
          responseSize: body.length,
          message: "OpenAI verbinding OK",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        return {
          providerId: definition.id,
          success: false,
          durationMs: Date.now() - started,
          responseSize: 0,
          message: `Test mislukt: ${message}`,
          error: message,
        };
      }
    },
  };
}
