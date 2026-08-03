import type {
  OutreachContactCandidate,
  OutreachIntelligenceContext,
  OutreachScoreBreakdown,
} from "@/features/outreach-intelligence/domain/types";
import type { OutreachChannelScores } from "@/features/outreach-intelligence/domain/types";

export function computeOutreachScore(
  context: OutreachIntelligenceContext,
  contact: OutreachContactCandidate | null,
  channelScores: OutreachChannelScores,
): { score: number; responseProbability: number; breakdown: OutreachScoreBreakdown } {
  const leadScore = Math.min(context.leadScore ?? 0, 100);
  const contactFit = contact?.score ?? 0;
  const signalRecency = computeSignalRecencyScore(context.lastSignalAt);
  const channelFit = Math.max(channelScores.email, channelScores.linkedin, channelScores.phone);
  const hiringIntensity = Math.min(context.hiringIntensity, 100);
  const contactAvailability = contact ? (contact.email ? 80 : contact.linkedinUrl ? 60 : 40) : 10;

  const breakdown: OutreachScoreBreakdown = {
    leadScore: Math.round(leadScore * 0.3),
    contactFit: Math.round(contactFit * 0.25),
    signalRecency: Math.round(signalRecency * 0.2),
    channelFit: Math.round(channelFit * 0.15),
    hiringIntensity: Math.round(hiringIntensity * 0.05),
    contactAvailability: Math.round(contactAvailability * 0.05),
  };

  const score = Math.min(
    100,
    breakdown.leadScore +
      breakdown.contactFit +
      breakdown.signalRecency +
      breakdown.channelFit +
      breakdown.hiringIntensity +
      breakdown.contactAvailability,
  );

  let responseProbability = 25;
  if (context.leadPriority === "A") responseProbability += 25;
  else if (context.leadPriority === "B") responseProbability += 15;
  else if (context.leadPriority === "C") responseProbability += 8;

  if (context.hiringIntensity >= 70) responseProbability += 15;
  if (context.vacancyCount > 0) responseProbability += 10;
  if (contact?.email) responseProbability += 12;
  if (signalRecency >= 80) responseProbability += 10;
  if (channelFit >= 75) responseProbability += 8;

  responseProbability = Math.min(92, Math.max(8, responseProbability));

  return { score, responseProbability, breakdown };
}

function computeSignalRecencyScore(lastSignalAt: string | null): number {
  if (!lastSignalAt) return 15;

  const hours = (Date.now() - new Date(lastSignalAt).getTime()) / (1000 * 60 * 60);
  if (hours <= 24) return 100;
  if (hours <= 72) return 85;
  if (hours <= 168) return 65;
  if (hours <= 720) return 40;
  return 20;
}
