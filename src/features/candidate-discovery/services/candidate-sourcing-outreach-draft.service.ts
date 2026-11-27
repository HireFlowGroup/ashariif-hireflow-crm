import "server-only";

import type { CandidateDiscoveryProposal } from "@/features/candidate-discovery/domain/candidate-discovery.persistence.types";
import type { Vacancy } from "@/features/vacancies/domain";

export type CandidateOutreachDraft = {
  subject: string;
  bodyText: string;
  channel: "linkedin_message";
  warnings: string[];
  generatedAt: string;
};

export function buildCandidateSourcingOutreachDraft(
  proposal: CandidateDiscoveryProposal,
  vacancy: Vacancy,
): CandidateOutreachDraft {
  const name = `${proposal.firstName} ${proposal.lastName}`.trim();
  const role = proposal.candidateCurrentRole ?? "jouw huidige rol";
  const strengths = proposal.matchStrongPoints.slice(0, 2);
  const warnings = [
    "Geen automatische verzending — concept alleen.",
    "Gebruik uitsluitend feiten uit het openbare LinkedIn-snippet.",
  ];

  const bodyLines = [
    `Beste ${proposal.firstName !== "Onbekend" ? proposal.firstName : name},`,
    "",
    `Ik kwam je profiel tegen via een openbare zoekindex en zag overlap met onze vacature "${vacancy.title}"${vacancy.location ? ` in ${vacancy.location}` : ""}.`,
    `Je profiel vermeldt: ${role}.`,
    strengths.length > 0 ? `Wat opviel: ${strengths.join("; ")}.` : null,
    "",
    "Zou je openstaan voor een kort, vrijblijvend gesprek over deze rol?",
    "",
    "Met vriendelijke groet,",
    "[Uw naam — HireFlow]",
  ].filter(Boolean);

  return {
    subject: `Vacature ${vacancy.title} — kort verkennend gesprek?`,
    bodyText: bodyLines.join("\n"),
    channel: "linkedin_message",
    warnings,
    generatedAt: new Date().toISOString(),
  };
}