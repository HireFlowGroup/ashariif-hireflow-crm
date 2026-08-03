import type { CompanyAnalysisContext } from "@/features/company-ai-analysis/domain/analysis.types";

export function buildAnalysisContextPayload(context: CompanyAnalysisContext): string {
  const lines: string[] = [
    "=== BEDRIJF ===",
    `Naam: ${context.companyName}`,
    `Sector: ${context.sector ?? "onbekend"}`,
    `Stad: ${context.city ?? "onbekend"}`,
    `Regio: ${context.region ?? "onbekend"}`,
    `Website: ${context.website ?? "onbekend"}`,
    `Domein: ${context.domain ?? "onbekend"}`,
    `LinkedIn: ${context.linkedinUrl ?? "onbekend"}`,
    `Werken-bij URL: ${context.careersUrl ?? "onbekend"}`,
    `Vacaturepagina: ${context.vacancyPageUrl ?? "onbekend"}`,
    "",
    "=== LEAD INTELLIGENCE ===",
    `Leadscore: ${context.leadScore ?? "onbekend"}`,
    `Prioriteit: ${context.leadPriority ?? "onbekend"}`,
    `Score reden: ${context.scoreReason ?? "onbekend"}`,
    `Hiring intensity: ${context.hiringIntensity}`,
    `Aantal signals: ${context.signalCount}`,
    `Laatste signal: ${context.lastSignalAt ?? "onbekend"}`,
    `ATS gedetecteerd: ${context.atsDetected ? "ja" : "nee"}`,
    `ATS providers: ${context.atsProviders.length > 0 ? context.atsProviders.join(", ") : "geen"}`,
    "",
    "=== HIRING SIGNALS ===",
  ];

  if (context.signals.length === 0) {
    lines.push("Geen hiring signals in HireFlow.");
  } else {
    for (const signal of context.signals.slice(0, 25)) {
      lines.push(
        [
          `- [${signal.typeLabel}] ${signal.title ?? "—"}`,
          `  Beschrijving: ${signal.description ?? "—"}`,
          `  Bron: ${signal.source ?? signal.provider}`,
          `  Confidence: ${signal.confidence ?? "—"}`,
          `  Importance: ${signal.importance}`,
          `  AI relevance: ${signal.aiRelevance}`,
          `  Waargenomen: ${signal.observedAt}`,
        ].join("\n"),
      );
    }
  }

  lines.push("", "=== VACATURES ===");

  if (context.vacancies.length === 0) {
    lines.push("Geen vacatures in HireFlow.");
  } else {
    for (const vacancy of context.vacancies) {
      lines.push(
        `- ${vacancy.title} (${vacancy.status}) · ${vacancy.location ?? "locatie onbekend"} · bron: ${vacancy.source ?? "onbekend"}`,
      );
    }
  }

  lines.push("", "=== CONTACTEN ===");

  if (context.contacts.length === 0) {
    lines.push("Geen contacten in HireFlow.");
  } else {
    for (const contact of context.contacts) {
      lines.push(
        `- ${contact.name} · ${contact.jobTitle ?? "functie onbekend"} · e-mail: ${contact.email ?? "—"} · LinkedIn: ${contact.linkedinUrl ?? "—"} · confidence: ${contact.confidence ?? "—"}`,
      );
    }
  }

  lines.push("", "=== OUTREACH INTELLIGENCE ===");
  lines.push(`Aanbevolen contact: ${context.outreachRecommendedContact ?? "onbekend"}`);
  lines.push(`Aanbevolen rol: ${context.outreachRecommendedRole ?? "onbekend"}`);
  lines.push(`Outreach angle: ${context.outreachAngle ?? "onbekend"}`);

  lines.push("", "=== VERGELIJKBARE BEDRIJVEN IN HIREFLOW ===");

  if (context.similarCompanies.length === 0) {
    lines.push("Geen vergelijkbare bedrijven gevonden in HireFlow.");
  } else {
    for (const company of context.similarCompanies) {
      lines.push(
        `- ${company.name} · sector: ${company.sector ?? "—"} · stad: ${company.city ?? "—"} · score: ${company.score ?? "—"} · intensity: ${company.hiringIntensity} · redenen: ${company.similarityReasons.join("; ") || "—"}`,
      );
    }
  }

  return lines.join("\n");
}
