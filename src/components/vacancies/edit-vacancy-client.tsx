"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VacancyForm } from "@/components/vacancies/vacancy-form";
import type { CompanyOption, VacancyFormValues } from "@/components/vacancies/types";

type EditVacancyClientProps = {
  vacancyId: string;
  companies: CompanyOption[];
  defaultValues: VacancyFormValues;
};

export function EditVacancyClient({
  vacancyId,
  companies,
  defaultValues,
}: EditVacancyClientProps) {
  const router = useRouter();

  async function handleUpdate(
    payload: Parameters<Parameters<typeof VacancyForm>[0]["onSubmit"]>[0],
  ) {
    const response = await fetch(`/api/vacancies/${vacancyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "Er ging iets mis. Probeer het opnieuw.");
    }

    toast.success("Vacature bijgewerkt");
    router.push(`/vacancies/${vacancyId}`);
    router.refresh();
  }

  return (
    <VacancyForm
      companies={companies}
      defaultValues={defaultValues}
      submitLabel="Wijzigingen opslaan"
      onSubmit={handleUpdate}
    />
  );
}
