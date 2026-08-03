"use client";

import { PageError } from "@/components/errors/page-error";

type AuthErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthError({ reset }: AuthErrorProps) {
  return (
    <PageError
      title="Inlogpagina kon niet worden geladen"
      message="Er is een tijdelijke fout opgetreden. Probeer het opnieuw."
      onRetry={reset}
    />
  );
}
