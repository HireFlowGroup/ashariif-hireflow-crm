"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArchiveVacancyDialog } from "@/components/vacancies/archive-vacancy-dialog";

type VacancyDetailActionsProps = {
  vacancyId: string;
  vacancyTitle: string;
  isClosed: boolean;
};

export function VacancyDetailActions({
  vacancyId,
  vacancyTitle,
  isClosed,
}: VacancyDetailActionsProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  async function handleArchive() {
    setIsArchiving(true);

    try {
      const response = await fetch(`/api/vacancies/${vacancyId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Er ging iets mis. Probeer het opnieuw.");
      }

      toast.success("Vacature gearchiveerd");
      router.refresh();
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href="/vacancies" className={buttonVariants({ variant: "outline" })}>
          Terug naar overzicht
        </Link>
        <Link
          href={`/vacancies/${vacancyId}/edit`}
          className={buttonVariants({ variant: "default" })}
        >
          Bewerken
        </Link>
        <Button
          type="button"
          variant="destructive"
          disabled={isClosed}
          onClick={() => setDialogOpen(true)}
        >
          Archiveren
        </Button>
      </div>

      <ArchiveVacancyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vacancyTitle={vacancyTitle}
        isSubmitting={isArchiving}
        onConfirm={handleArchive}
      />
    </>
  );
}
