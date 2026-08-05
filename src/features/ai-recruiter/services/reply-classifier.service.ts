import type { ReplyAnalysis, ReplyClassification } from "@/features/ai-recruiter/domain/types";
import { replyAnalysisSchema } from "@/features/ai-recruiter/domain/types";

type ClassificationRule = {
  classification: ReplyClassification;
  keywords: string[];
  weight: number;
};

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    classification: "spam",
    keywords: [
      "viagra",
      "crypto",
      "bitcoin",
      "lottery",
      "you won",
      "click here to claim",
      "nigerian",
      "seo services",
      "link building",
      "webdesign aanbieding",
    ],
    weight: 0.92,
  },
  {
    classification: "automatisch_antwoord",
    keywords: [
      "undeliverable",
      "delivery failed",
      "mailer-daemon",
      "postmaster",
      "bounce",
      "mailbox full",
      "unknown user",
      "automatic reply",
      "automatisch antwoord",
      "auto-reply",
      "do not reply",
      "noreply",
      "this is an automated",
      "dit is een automatisch",
    ],
    weight: 0.9,
  },
  {
    classification: "out_of_office",
    keywords: [
      "out of office",
      "out-of-office",
      "afwezig",
      "niet op kantoor",
      "beperkt bereikbaar",
      "terug op",
      "back on",
      "vakantie",
      "on vacation",
      "away from",
    ],
    weight: 0.88,
  },
  {
    classification: "afgewezen",
    keywords: [
      "unsubscribe",
      "uitschrijven",
      "niet meer mailen",
      "opt-out",
      "afmelden",
      "stop emailing",
      "remove me",
      "verwijder mijn gegevens",
      "nooit meer contact",
      "do not contact",
    ],
    weight: 0.9,
  },
  {
    classification: "geen_interesse",
    keywords: [
      "geen interesse",
      "not interested",
      "niet relevant",
      "niet geinteresseerd",
      "niet geïnteresseerd",
      "passen we af",
      "geen behoefte",
      "no need",
      "niet nodig",
      "niet van plan",
    ],
    weight: 0.85,
  },
  {
    classification: "nieuwe_opdracht",
    keywords: [
      "nieuwe opdracht",
      "vacature invullen",
      "kunnen jullie helpen",
      "offerte",
      "samenwerking",
      "contract",
      "inhuur",
      "detacheren",
      "werving voor",
      "recruitment partner",
      "starten met",
      "graag jullie ondersteuning",
      "rol invullen",
    ],
    weight: 0.82,
  },
  {
    classification: "later",
    keywords: [
      "later",
      "volgende maand",
      "volgende kwartaal",
      "over een paar",
      "niet nu",
      "q1",
      "q2",
      "q3",
      "q4",
      "na de zomer",
      "begin volgend jaar",
      "herinner me",
      "neem contact op in",
    ],
    weight: 0.8,
  },
  {
    classification: "interesse",
    keywords: [
      "interesse",
      "graag",
      "afspraak",
      "bellen",
      "meeting",
      "kennismaken",
      "interested",
      "doorverwijzen",
      "collega",
      "contactpersoon",
      "neem contact op met",
      "laten we",
      "prima",
      "goed idee",
      "stuur maar",
      "plan maar in",
    ],
    weight: 0.78,
  },
];

function normalizeText(subject: string | null, body: string | null): string {
  return `${subject ?? ""}\n${body ?? ""}`.toLowerCase();
}

function matchKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(keyword));
}

export function classifyReplyWithConfidence(
  subject: string | null,
  body: string | null,
): ReplyAnalysis {
  const text = normalizeText(subject, body);
  let best: { classification: ReplyClassification; signals: string[]; confidence: number } | null =
    null;

  for (const rule of CLASSIFICATION_RULES) {
    const signals = matchKeywords(text, rule.keywords);
    if (signals.length === 0) continue;

    const subjectBoost = signals.some((signal) => (subject ?? "").toLowerCase().includes(signal))
      ? 0.08
      : 0;
    const multiMatchBoost = Math.min(0.12, (signals.length - 1) * 0.06);
    const confidence = Math.min(0.97, rule.weight + subjectBoost + multiMatchBoost);

    if (!best || confidence > best.confidence) {
      best = { classification: rule.classification, signals, confidence };
    }
  }

  if (!best) {
    return replyAnalysisSchema.parse({
      classification: "onbekend",
      confidence: 0.35,
      signals: [],
      reasoning: "Geen duidelijke signalen in onderwerp of inhoud.",
    });
  }

  return replyAnalysisSchema.parse({
    classification: best.classification,
    confidence: Number(best.confidence.toFixed(2)),
    signals: best.signals,
    reasoning: `Gedetecteerd op basis van: ${best.signals.slice(0, 3).join(", ")}.`,
  });
}

/** @deprecated Use classifyReplyWithConfidence — kept for backwards compatibility. */
export function classifyReply(subject: string | null, body: string | null): ReplyClassification {
  return classifyReplyWithConfidence(subject, body).classification;
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
  shouldAutoReply: boolean;
};

export function getReplyFollowUpAction(classification: ReplyClassification): ReplyFollowUpAction {
  switch (classification) {
    case "nieuwe_opdracht":
      return {
        pipelineStage: "replied_new_assignment",
        createTask: true,
        taskTitle: "Nieuwe opdracht bespreken",
        taskDueDays: 1,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: true,
      };
    case "interesse":
      return {
        pipelineStage: "replied_positive",
        createTask: true,
        taskTitle: "Positieve reactie opvolgen",
        taskDueDays: 1,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: true,
      };
    case "later":
      return {
        pipelineStage: "replied_later",
        createTask: true,
        taskTitle: "Later opvolgen na interesse",
        taskDueDays: 30,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: true,
      };
    case "geen_interesse":
      return {
        pipelineStage: "replied_negative",
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: 180,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: true,
      };
    case "afgewezen":
      return {
        pipelineStage: "opt_out",
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: null,
        addSuppression: true,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: true,
      };
    case "automatisch_antwoord":
      return {
        pipelineStage: "auto_reply",
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: 3,
        addSuppression: false,
        markEmailInvalid: true,
        suggestNewContact: false,
        shouldAutoReply: false,
      };
    case "out_of_office":
      return {
        pipelineStage: "out_of_office",
        createTask: true,
        taskTitle: "Opvolgen na terugkeer afwezigheid",
        taskDueDays: 7,
        suppressDays: 14,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: false,
      };
    case "spam":
      return {
        pipelineStage: "spam",
        createTask: false,
        taskTitle: null,
        taskDueDays: null,
        suppressDays: null,
        addSuppression: true,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: false,
      };
    default:
      return {
        pipelineStage: null,
        createTask: true,
        taskTitle: "Reactie handmatig beoordelen",
        taskDueDays: 2,
        suppressDays: null,
        addSuppression: false,
        markEmailInvalid: false,
        suggestNewContact: false,
        shouldAutoReply: false,
      };
  }
}
