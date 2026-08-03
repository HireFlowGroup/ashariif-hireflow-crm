"use client";

import { PageError } from "@/components/errors/page-error";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="nl">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <PageError
          title="HireFlow is tijdelijk niet beschikbaar"
          message="Er is een onverwachte fout opgetreden. Herlaad de pagina of herstart de development server."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
