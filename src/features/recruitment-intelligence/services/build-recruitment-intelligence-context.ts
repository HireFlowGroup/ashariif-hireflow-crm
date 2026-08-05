import type { RecruitmentIntelligenceInput } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";

export function computeInputFingerprint(input: Pick<
  RecruitmentIntelligenceInput,
  "vacancies" | "signals" | "contacts" | "website" | "companyName"
>): string {
  return [
    input.companyName,
    input.website ?? "",
    input.vacancies.length,
    input.signals.length,
    input.contacts.length,
    input.vacancies[0]?.id ?? "",
    input.signals[0]?.id ?? "",
    input.contacts[0]?.id ?? "",
  ].join("|");
}

export function buildRecruitmentIntelligencePayload(input: RecruitmentIntelligenceInput): string {
  const lines: string[] = [
    "Beantwoord per bedrijf de volgende recruitment intelligence vragen UITSLUITEND op basis van onderstaande feiten.",
    "Bij ontbrekende data: exact \"Onvoldoende informatie.\" — NOOIT gokken.",
    "",
    "=== BEDRIJF ===",
    `Naam: ${input.companyName}`,
    `Website: ${input.website ?? "onbekend"}`,
    `Domein: ${input.domain ?? "onbekend"}`,
    `LinkedIn: ${input.linkedinUrl ?? "onbekend"}`,
    `Sector: ${input.sector ?? "onbekend"}`,
    `Locatie: ${[input.city, input.region].filter(Boolean).join(", ") || "onbekend"}`,
    `Medewerkers: ${input.employeeLabel ?? "onbekend"}`,
    "",
    "=== VACATURES ===",
  ];

  if (input.vacancies.length === 0) {
    lines.push("Geen vacatures beschikbaar.");
  } else {
    for (const vacancy of input.vacancies.slice(0, 30)) {
      lines.push(
        `- ${vacancy.title} (${vacancy.status}) · ${vacancy.location ?? "locatie onbekend"} · sinds: ${vacancy.createdAt ?? "onbekend"}`,
      );
    }
  }

  lines.push("", "=== HIRING SIGNALS ===");

  if (input.signals.length === 0) {
    lines.push("Geen hiring signals beschikbaar.");
  } else {
    for (const signal of input.signals.slice(0, 30)) {
      lines.push(
        [
          `- [${signal.typeLabel}] ${signal.title ?? "—"}`,
          `  Beschrijving: ${signal.description ?? "—"}`,
          `  Bron: ${signal.source ?? "—"}`,
          `  Confidence: ${signal.confidence ?? "—"}`,
          `  Waargenomen: ${signal.observedAt ?? "—"}`,
        ].join("\n"),
      );
    }
  }

  lines.push("", "=== CONTACTPERSONEN ===");

  if (input.contacts.length === 0) {
    lines.push("Geen contactpersonen beschikbaar.");
  } else {
    for (const contact of input.contacts.slice(0, 20)) {
      lines.push(
        `- ${contact.name} · ${contact.jobTitle ?? "functie onbekend"} · e-mail: ${contact.email ?? "—"} · LinkedIn: ${contact.linkedinUrl ?? "—"} · confidence: ${contact.confidence ?? "—"}`,
      );
    }
  }

  return lines.join("\n");
}
