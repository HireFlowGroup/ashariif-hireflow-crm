"use client";

import { Loader2, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AiComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  errorMessage?: string | null;
};

export function AiComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isStreaming = false,
  errorMessage = null,
}: AiComposerProps) {
  const isDisabled = disabled || isStreaming;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isDisabled && value.trim()) {
        onSubmit();
      }
    }
  }

  return (
    <div className="border-t bg-card p-4">
      {errorMessage ? (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stel een vraag aan HireFlow AI…"
          rows={3}
          disabled={isDisabled}
          className="min-h-[88px] resize-none sm:flex-1"
          aria-label="Bericht aan HireFlow AI"
        />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isDisabled || !value.trim()}
          className="sm:shrink-0"
        >
          {isStreaming ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Bezig…
            </>
          ) : (
            <>
              <SendHorizonal aria-hidden />
              Versturen
            </>
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Enter om te versturen · Shift+Enter voor een nieuwe regel
      </p>
    </div>
  );
}
