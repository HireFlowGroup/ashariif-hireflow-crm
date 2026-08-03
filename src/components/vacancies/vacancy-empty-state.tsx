import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

type VacancyEmptyStateProps = {
  hasFilters?: boolean;
};

export function VacancyEmptyState({ hasFilters = false }: VacancyEmptyStateProps) {
  return (
    <EmptyState
      title="Geen vacatures gevonden"
      description={
        hasFilters
          ? "Pas je zoekterm of filters aan en probeer het opnieuw."
          : "Maak je eerste vacature aan om open rollen bij bedrijven te beheren."
      }
      action={
        hasFilters ? undefined : (
          <Link href="/vacancies/new" className={buttonVariants({ variant: "default" })}>
            Nieuwe vacature
          </Link>
        )
      }
    />
  );
}
