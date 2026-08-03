"use client";

import { PageError } from "@/components/errors/page-error";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ reset }: DashboardErrorProps) {
  return (
    <PageError
      title="Pagina kon niet worden geladen"
      message="Er is een fout opgetreden. Dit kan tijdelijk zijn na code-wijzigingen. Klik op opnieuw proberen, of herstart de dev server met: npm run dev:clean"
      onRetry={reset}
    />
  );
}
