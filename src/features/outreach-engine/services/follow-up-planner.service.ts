import "server-only";

const WORKDAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpPlanStatus =
  | "scheduled"
  | "cancelled"
  | "due"
  | "sent"
  | "skipped_reply_received"
  | "skipped_opt_out"
  | "failed";

export type FollowUpPlanItem = {
  sequenceNumber: 1 | 2;
  scheduledFor: string;
  status: FollowUpPlanStatus;
  draftSubject: string;
  draftBodyText: string;
};

export type FollowUpCancelReason =
  | "reply_received"
  | "opt_out"
  | "bounce"
  | "manual"
  | "send_disabled";

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setTime(result.getTime() + WORKDAY_MS);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
}

export function buildFollowUpSchedule(
  sentAt: Date,
  originalSubject: string,
  companyName: string,
): FollowUpPlanItem[] {
  const followUp1Date = addBusinessDays(sentAt, 4);
  const followUp2Date = addBusinessDays(sentAt, 7);

  return [
    {
      sequenceNumber: 1,
      scheduledFor: followUp1Date.toISOString(),
      status: "scheduled",
      draftSubject: originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,
      draftBodyText: [
        "Geachte heer/mevrouw,",
        "",
        `Ik wilde kort terugkomen op mijn eerdere mail over de hiring-situatie bij ${companyName}.`,
        "Staat u nog open voor een korte selectie van geschikte kandidaten?",
        "",
        "Met vriendelijke groet,",
        "HireFlow Group",
      ].join("\n"),
    },
    {
      sequenceNumber: 2,
      scheduledFor: followUp2Date.toISOString(),
      status: "scheduled",
      draftSubject: originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,
      draftBodyText: [
        "Geachte heer/mevrouw,",
        "",
        `Laatste follow-up over ons voorstel om kandidaten voor ${companyName} te zoeken.`,
        "Laat het gerust weten als dit nu niet past — dan houd ik het hierbij.",
        "",
        "Met vriendelijke groet,",
        "HireFlow Group",
      ].join("\n"),
    },
  ];
}

export function cancelFollowUpsOnEvent(
  items: FollowUpPlanItem[],
  reason: FollowUpCancelReason,
): FollowUpPlanItem[] {
  const status: FollowUpPlanStatus =
    reason === "reply_received"
      ? "skipped_reply_received"
      : reason === "opt_out"
        ? "skipped_opt_out"
        : "cancelled";

  return items.map((item) =>
    item.status === "scheduled" || item.status === "due"
      ? { ...item, status }
      : item,
  );
}
