import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiSuggestion } from "@/components/ai/suggestions";

type AiSuggestionCardProps = {
  suggestion: AiSuggestion;
  disabled?: boolean;
  onSelect: (prompt: string) => void;
};

export function AiSuggestionCard({
  suggestion,
  disabled = false,
  onSelect,
}: AiSuggestionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(suggestion.prompt)}
      className="h-full text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{suggestion.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
        </CardContent>
      </Card>
    </button>
  );
}
