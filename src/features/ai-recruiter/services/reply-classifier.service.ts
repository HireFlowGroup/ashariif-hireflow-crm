import type { ReplyClassification } from "@/features/ai-recruiter/domain/types";

const POSITIVE_KEYWORDS = ["interesse", "graag", "afspraak", "bellen", "meeting", "kennismaken", "interested"];
const LATER_KEYWORDS = ["later", "volgende maand", "over een paar", "niet nu", "q1", "q2", "q3", "q4"];
const NOT_INTERESTED_KEYWORDS = ["geen interesse", "not interested", "stop", "niet relevant"];
const UNSUBSCRIBE_KEYWORDS = ["unsubscribe", "uitschrijven", "niet meer mailen", "opt-out", "afmelden"];
const OOO_KEYWORDS = ["out of office", "afwezig", "automatic reply", "automatisch antwoord", "vakantie"];
const BOUNCE_KEYWORDS = ["undeliverable", "delivery failed", "bounce", "mailbox full", "unknown user"];
const REFERRAL_KEYWORDS = ["doorverwijzen", "collega", "contactpersoon", "neem contact op met"];

export function classifyReply(
  subject: string | null,
  body: string | null,
): ReplyClassification {
  const text = `${subject ?? ""} ${body ?? ""}`.toLowerCase();

  if (BOUNCE_KEYWORDS.some((k) => text.includes(k))) return "bounce";
  if (UNSUBSCRIBE_KEYWORDS.some((k) => text.includes(k))) return "unsubscribe";
  if (NOT_INTERESTED_KEYWORDS.some((k) => text.includes(k))) return "not_interested";
  if (OOO_KEYWORDS.some((k) => text.includes(k))) return "out_of_office";
  if (REFERRAL_KEYWORDS.some((k) => text.includes(k))) return "referral";
  if (LATER_KEYWORDS.some((k) => text.includes(k))) return "interested_later";
  if (POSITIVE_KEYWORDS.some((k) => text.includes(k))) return "positive";

  return "unknown";
}

export type ReplyFollowUpAction = {
  pipelineStage: string | null;
  createTask: boolean;
  taskTitle: string | null;
  taskDueDays: number | null;
  suppressDays: number | null;
  addSuppression: boolean;
  markEmailInvalid: boolean;
  suggestNewContact: boolean;
};

export function getReplyFollowUpAction(classification: ReplyClassification): ReplyFollowUpAction {
  switch (classification) {
    case "positive":
      return {
        pipelineStage: "replied_positive",
        createTask: true,
        taskTitle: "Positieve reactie opvolgen",
        taskDueDays: 1,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
      };
    case "interested_later":
      return {
        pipelineStage: "replied_later",
        createTask: true,
        taskTitle: "Later opvolgen na interesse",
        taskDueDays: 30,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
      };
    case "referral":
      return {
        pipelineStage: "replied_referral",
        createTask: true,
        taskTitle: "Referral contact verwerken",
        taskDueDays: 2,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: true,
      };
    case "not_interested":
      return {
        pipelineStage: "replied_negative",
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: 180,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
      };
    case "unsubscribe":
      return {
        pipelineStage: "opt_out",
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: null,
        addSuppression: true,
        markEmailInvalid: false,
        suggestNewContact: false,
      };
    case "bounce":
      return {
        pipelineStage: "bounced",
        createTask: true,
        taskTitle: "Nieuw contact zoeken na bounce",
        taskDueDays: 1,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: true,
        suggestNewContact: true,
      };
    default:
      return {
        pipelineStage: null,
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
      };
  }
}
