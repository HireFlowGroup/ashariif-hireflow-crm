import type {
  OutreachChannel,
  OutreachChannelScores,
  OutreachContactCandidate,
  OutreachIntelligenceContext,
} from "@/features/outreach-intelligence/domain/types";

const HR_KEYWORDS = ["hr", "recruiter", "recruitment", "talent", "people", "human resources"];
const DIRECTOR_KEYWORDS = ["director", "ceo", "founder", "owner", "managing", "directeur"];

export function rankContacts(context: OutreachIntelligenceContext): OutreachContactCandidate[] {
  const hasVacancies = context.vacancyCount > 0;
  const preferredKeywords = hasVacancies ? HR_KEYWORDS : DIRECTOR_KEYWORDS;

  return context.contacts
    .map((contact) => {
      const name = `${contact.firstName} ${contact.lastName}`.trim();
      const title = (contact.jobTitle ?? "").toLowerCase();
      const reasons: string[] = [];
      let score = 0;

      if (preferredKeywords.some((keyword) => title.includes(keyword))) {
        score += 35;
        reasons.push(hasVacancies ? "HR/recruitment rol" : "Beslissingsnemer rol");
      }

      if (contact.email) {
        score += 20;
        reasons.push("E-mailadres beschikbaar");
      }

      if (contact.phone) {
        score += 15;
        reasons.push("Telefoonnummer beschikbaar");
      }

      if (contact.linkedinUrl) {
        score += 15;
        reasons.push("LinkedIn profiel beschikbaar");
      }

      if (contact.confidence !== null && contact.confidence >= 0.7) {
        score += 10;
        reasons.push("Hoge betrouwbaarheid contact");
      }

      if (reasons.length === 0) {
        reasons.push("Enig beschikbaar contact");
        score += 5;
      }

      return {
        id: contact.id,
        name,
        jobTitle: contact.jobTitle,
        email: contact.email,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        confidence: contact.confidence,
        score: Math.min(score, 100),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function scoreChannels(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
): { scores: OutreachChannelScores; recommended: OutreachChannel; reason: string } {
  const emailScore = scoreEmailChannel(context, contact);
  const linkedinScore = scoreLinkedInChannel(context, contact);
  const phoneScore = scorePhoneChannel(context, contact);

  const scores: OutreachChannelScores = {
    email: emailScore.score,
    linkedin: linkedinScore.score,
    phone: phoneScore.score,
  };

  const ranked = [
    { channel: "email" as const, score: scores.email, reason: emailScore.reason },
    { channel: "linkedin" as const, score: scores.linkedin, reason: linkedinScore.reason },
    { channel: "phone" as const, score: scores.phone, reason: phoneScore.reason },
  ].sort((a, b) => b.score - a.score);

  const best = ranked[0]!;

  return {
    scores,
    recommended: best.channel,
    reason: best.reason,
  };
}

function scoreEmailChannel(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
): { score: number; reason: string } {
  if (contact?.email) {
    return { score: 85, reason: "Direct e-mailadres van contactpersoon beschikbaar" };
  }
  if (context.email) {
    return { score: 65, reason: "Algemeen bedrijfs-e-mailadres beschikbaar" };
  }
  return { score: 20, reason: "Geen e-mailadres — laagste betrouwbaarheid" };
}

function scoreLinkedInChannel(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
): { score: number; reason: string } {
  if (contact?.linkedinUrl) {
    return { score: 80, reason: "LinkedIn profiel contact beschikbaar voor connectie/bericht" };
  }
  if (context.linkedinUrl) {
    return { score: 60, reason: "Bedrijfspagina LinkedIn beschikbaar" };
  }
  return { score: 25, reason: "Geen LinkedIn gegevens" };
}

function scorePhoneChannel(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
): { score: number; reason: string } {
  let score = 0;
  if (contact?.phone) score += 55;
  if (context.phone) score += 25;

  const urgent =
    (context.leadPriority === "A" || context.leadPriority === "B") &&
    context.lastSignalAt &&
    Date.now() - new Date(context.lastSignalAt).getTime() < 72 * 60 * 60 * 1000;

  if (urgent) score += 25;

  if (score >= 70) {
    return { score: Math.min(score, 90), reason: "Telefoon beschikbaar + warme lead — direct contact effectief" };
  }
  if (score >= 40) {
    return { score, reason: "Telefoon beschikbaar voor follow-up" };
  }
  return { score: 15, reason: "Geen telefoonnummer — telefonisch outreach niet optimaal" };
}

export function computeBestMoment(context: OutreachIntelligenceContext): {
  at: string;
  label: string;
  reason: string;
  followUpAt: string;
} {
  const now = new Date();

  if (context.lastSignalAt) {
    const signalAge = now.getTime() - new Date(context.lastSignalAt).getTime();
    const hoursSinceSignal = signalAge / (1000 * 60 * 60);

    if (hoursSinceSignal <= 48) {
      const moment = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const followUp = addBusinessDays(moment, 5);
      return {
        at: moment.toISOString(),
        label: "Vandaag — binnen 4 uur",
        reason: "Recent hiring signaal (<48u) — snelle outreach verhoogt response rate",
        followUpAt: followUp.toISOString(),
      };
    }
  }

  const nextSlot = nextBusinessMorning(now);
  const followUp = addBusinessDays(nextSlot, 5);

  return {
    at: nextSlot.toISOString(),
    label: formatSlotLabel(nextSlot),
    reason: "Optimaal venster: dinsdag–donderdag 10:00 (highest B2B response rates)",
    followUpAt: followUp.toISOString(),
  };
}

function nextBusinessMorning(from: Date): Date {
  const candidate = new Date(from);
  candidate.setHours(10, 0, 0, 0);

  while (candidate.getDay() === 0 || candidate.getDay() === 6 || candidate <= from) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(10, 0, 0, 0);
  }

  while (candidate.getDay() === 1 || candidate.getDay() === 5) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(10, 0, 0, 0);
  }

  return candidate;
}

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added += 1;
    }
  }

  result.setHours(10, 0, 0, 0);
  return result;
}

function formatSlotLabel(date: Date): string {
  return date.toLocaleString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
