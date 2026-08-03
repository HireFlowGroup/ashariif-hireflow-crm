import type { OutreachIntelligenceContext } from "@/features/outreach-intelligence/domain/types";
import { getSignalTypeLabel } from "@/features/hiring-intelligence/domain/signal-types";

export function buildOutreachGeneratorPayload(
  context: OutreachIntelligenceContext,
  contactName: string | null,
): string {
  const signalLines = context.signals.slice(0, 8).map((signal, index) => {
    const label = getSignalTypeLabel(signal.signalType as never);
    return [
      `${index + 1}. [${label}] ${signal.title ?? "—"}`,
      `   Beschrijving: ${signal.description ?? "—"}`,
      `   Waargenomen: ${signal.observedAt}`,
      `   Importance: ${signal.importance}`,
    ].join("\n");
  });

  const vacancyLines = context.vacancies.slice(0, 8).map(
    (vacancy) => `- ${vacancy.title} (sinds ${vacancy.createdAt})`,
  );

  const contactLines = context.contacts.slice(0, 5).map(
    (contact) =>
      `- ${contact.firstName} ${contact.lastName}${contact.jobTitle ? ` (${contact.jobTitle})` : ""}${contact.email ? ` · ${contact.email}` : ""}`,
  );

  return [
    "=== BEDRIJF (HireFlow) ===",
    `Naam: ${context.companyName}`,
    `Sector: ${context.sector ?? "onbekend"}`,
    `Stad: ${context.city ?? "onbekend"}`,
    `Website: ${context.website ?? "onbekend"}`,
    `LinkedIn: ${context.linkedinUrl ?? "onbekend"}`,
    "",
    "=== LEAD DATA ===",
    `Leadscore: ${context.leadScore ?? "onbekend"}`,
    `Prioriteit: ${context.leadPriority ?? "onbekend"}`,
    `Hiring intensity: ${context.hiringIntensity}`,
    `Aantal signals: ${context.signalCount}`,
    `Laatste signaal: ${context.lastSignalAt ?? "onbekend"}`,
    `Vacatures: ${context.vacancyCount}`,
    "",
    "=== HIRING SIGNALS (VERPLICHT TE REFEREREN) ===",
    signalLines.length > 0 ? signalLines.join("\n") : "Geen hiring signals — schrijf dat expliciet.",
    "",
    "=== VACATURES ===",
    vacancyLines.length > 0 ? vacancyLines.join("\n") : "Geen vacatures in HireFlow.",
    "",
    "=== CONTACTEN ===",
    contactLines.length > 0 ? contactLines.join("\n") : "Geen contacten in HireFlow.",
    "",
    "=== AI SAMENVATTING ===",
    context.aiSummary ?? "Geen AI samenvatting.",
    "",
    "=== DOELCONTACT ===",
    contactName ?? "Geen specifiek contact — algemene aanhef.",
  ].join("\n");
}

export function extractSignalLabels(context: OutreachIntelligenceContext): string[] {
  return context.signals.map((signal) => {
    const label = getSignalTypeLabel(signal.signalType as never);
    return signal.title ? `${label}: ${signal.title}` : label;
  });
}
