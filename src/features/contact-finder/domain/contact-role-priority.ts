/** Canonical Contact Intelligence role priority (first match wins). */
export const CONTACT_ROLE_PRIORITY = [
  {
    label: "HR Manager",
    score: 100,
    match: (title: string) =>
      /hr manager|head of hr|hoofd hr|hr-directeur|directeur hr/i.test(title),
  },
  {
    label: "Recruiter",
    score: 95,
    match: (title: string) =>
      !/recruitment manager|teamlead|team lead|lead recruiter|recruitment lead|talent acquisition/i.test(title)
      && /recruiter|recruitment consultant|wervingsadviseur|corporate recruiter/i.test(title),
  },
  {
    label: "Talent Acquisition",
    score: 90,
    match: (title: string) => /talent acquisition|ta manager|talent manager/i.test(title),
  },
  {
    label: "HR Business Partner",
    score: 85,
    match: (title: string) => /hr business partner|hrbp/i.test(title),
  },
  {
    label: "Teamlead Recruitment",
    score: 82,
    match: (title: string) =>
      /teamlead recruitment|team lead recruitment|recruitment manager|lead recruiter|recruitment lead|head of recruitment/i.test(title),
  },
  {
    label: "Directeur",
    score: 70,
    match: (title: string) =>
      /directeur|director|ceo|eigenaar|owner|managing director|founder|oprichter/i.test(title),
  },
] as const;

export const DEFAULT_CONTACT_TARGET_ROLES = [
  "HR Manager",
  "Recruiter",
  "Talent Acquisition",
  "HR Business Partner",
  "Teamlead Recruitment",
  "Directeur",
] as const;

/** Mailbox fallback when no personal email: recruitment@ → hr@ → jobs@ → info@ */
export const MAILBOX_FALLBACK_PREFIXES = ["recruitment", "hr", "jobs", "info"] as const;

export const MAILBOX_PREFIX_SCORES: Array<{ prefixes: string[]; score: number; label: string }> = [
  { prefixes: ["recruitment", "recruiter"], score: 65, label: "recruitment@" },
  { prefixes: ["hr"], score: 60, label: "hr@" },
  { prefixes: ["jobs"], score: 50, label: "jobs@" },
  { prefixes: ["info"], score: 35, label: "info@" },
];

export type MatchedContactRole = {
  label: string;
  score: number;
};

export function matchContactRole(jobTitle: string | null | undefined): MatchedContactRole | null {
  const title = (jobTitle ?? "").toLowerCase().trim();
  if (!title) return null;

  for (const role of CONTACT_ROLE_PRIORITY) {
    if (role.match(title)) {
      return { label: role.label, score: role.score };
    }
  }

  return null;
}

export function scoreMailboxPrefix(emailLocal: string): number {
  for (const mailbox of MAILBOX_PREFIX_SCORES) {
    if (mailbox.prefixes.some((p) => emailLocal.startsWith(p))) {
      return mailbox.score;
    }
  }
  return 30;
}

export function rankMailboxEmail(email: string): number {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const idx = MAILBOX_FALLBACK_PREFIXES.findIndex((p) => local.startsWith(p));
  return idx === -1 ? MAILBOX_FALLBACK_PREFIXES.length : idx;
}

export function pickBestMailboxEmail(emails: string[]): string | null {
  const valid = emails.filter(Boolean).map((e) => e.trim().toLowerCase());
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => rankMailboxEmail(a) - rankMailboxEmail(b))[0] ?? null;
}
