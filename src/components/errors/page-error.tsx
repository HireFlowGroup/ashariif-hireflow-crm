"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function PageError({
  title = "Er ging iets mis",
  message = "De pagina kon niet worden geladen. Probeer het opnieuw of herstart de development server als dit blijft gebeuren.",
  onRetry,
}: PageErrorProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      ) : null}
    </div>
  );
}
