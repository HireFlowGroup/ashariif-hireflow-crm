import { EmptyState } from "@/components/shared/empty-state";

type CompanyEmptyStateProps = {
  hasFilters?: boolean;
};

export function CompanyEmptyState({ hasFilters = false }: CompanyEmptyStateProps) {
  if (hasFilters) {
    return (
      <EmptyState
        title="Geen bedrijven gevonden"
        description="Pas je zoekopdracht of filters aan om andere bedrijven te vinden."
      />
    );
  }

  return (
    <EmptyState
      title="Geen bedrijven gevonden"
      description="Er staan nog geen bedrijven in je organisatie. Maak een bedrijf aan via de AI-assistent of voeg er later handmatig een toe."
    />
  );
}
