"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ArchiveVacancyDialogProps = {
  vacancyTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
};

export function ArchiveVacancyDialog({
  vacancyTitle,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: ArchiveVacancyDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleConfirm() {
    setErrorMessage(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Er ging iets mis. Probeer het opnieuw.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Vacature archiveren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Weet je zeker dat je &quot;{vacancyTitle}&quot; wilt archiveren? De
            status wordt op gesloten gezet.
          </p>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Bezig…" : "Archiveren"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
