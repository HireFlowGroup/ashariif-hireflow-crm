"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VacancyForm } from "@/components/vacancies/vacancy-form";
import type { CompanyOption } from "@/components/vacancies/types";

type NewVacancyClientProps = {
  companies: CompanyOption[];
};

export function NewVacancyClient({ companies }: NewVacancyClientProps) {
  const router = useRouter();

  async function handleCreate(payload: Parameters<Parameters<typeof VacancyForm>[0]["onSubmit"]>[0]) {
    const response = await fetch("/api/vacancies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "Er ging iets mis. Probeer het opnieuw.");
    }

    const body = (await response.json()) as { vacancy: { id: string } };
    toast.success("Vacature opgeslagen");
    router.push(`/vacancies/${body.vacancy.id}`);
    router.refresh();
  }

  if (companies.length === 0) {
    return (
      <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        Er zijn nog geen bedrijven beschikbaar. Maak eerst een bedrijf aan via de AI-assistent
        of voeg bedrijven toe zodra die module beschikbaar is.
      </p>
    );
  }

  return (
    <VacancyForm
      companies={companies}
      submitLabel="Vacature opslaan"
      onSubmit={handleCreate}
    />
  );
}
