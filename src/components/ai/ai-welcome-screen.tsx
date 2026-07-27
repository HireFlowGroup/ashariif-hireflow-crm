import { Sparkles } from "lucide-react";
import { AiSuggestionCard } from "@/components/ai/ai-suggestion-card";
import { AI_SUGGESTIONS } from "@/components/ai/suggestions";

type AiWelcomeScreenProps = {
  disabled?: boolean;
  onSelectSuggestion: (prompt: string) => void;
};

export function AiWelcomeScreen({
  disabled = false,
  onSelectSuggestion,
}: AiWelcomeScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8">
      <div className="mb-8 max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Welkom bij HireFlow AI</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Je assistent voor recruitment, sales en planning. Stel een vraag of kies een
          suggestie om te beginnen.
        </p>
      </div>
      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
        {AI_SUGGESTIONS.map((suggestion) => (
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
