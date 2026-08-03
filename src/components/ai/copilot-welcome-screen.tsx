"use client";

import { BrainCircuit, Database, ShieldCheck } from "lucide-react";

import { AiSuggestionCard } from "@/components/ai/ai-suggestion-card";
import { COPILOT_SUGGESTIONS } from "@/components/ai/suggestions";
import { Badge } from "@/components/ui/badge";

type CopilotWelcomeScreenProps = {
  disabled?: boolean;
  onSelectSuggestion: (prompt: string) => void;
};

export function CopilotWelcomeScreen({
  disabled = false,
  onSelectSuggestion,
}: CopilotWelcomeScreenProps) {
  return (
    <div className="flex h-full flex-col overflow-auto px-4 py-8">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/10 text-violet-600 dark:text-violet-400">
          <BrainCircuit className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Recruitment Copilot</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Het hart van HireFlow. Stel recruitment-vragen en krijg onderbouwde antwoorden uit je
          database — structured tools + RAG, nooit gegok.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <Database className="size-3" />
            HireFlow data
          </Badge>
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <ShieldCheck className="size-3" />
            Geen hallucinaties
          </Badge>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-2">
        {COPILOT_SUGGESTIONS.map((suggestion) => (
          <AiSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            disabled={disabled}
            onSelect={onSelectSuggestion}
          />
        ))}
      </div>
    </div>
  );
}

/** @deprecated Use CopilotWelcomeScreen */
export const AiWelcomeScreen = CopilotWelcomeScreen;
