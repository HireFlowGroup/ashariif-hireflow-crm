export const OUTREACH_WRITING_STYLES = [
  "formal",
  "friendly",
  "direct",
  "consultative",
] as const;

export type OutreachWritingStyle = (typeof OUTREACH_WRITING_STYLES)[number];

export const OUTREACH_WRITING_STYLE_LABELS: Record<OutreachWritingStyle, string> = {
  formal: "Formeel",
  friendly: "Vriendelijk",
  direct: "Direct",
  consultative: "Consultatief",
};

export type OutreachMessageBlock = {
  subject?: string | null;
  body: string;
  referencedSignals: string[];
};

export type OutreachCallScript = {
  opening: string;
  discovery: string;
  valueProposition: string;
  close: string;
  referencedSignals: string[];
};

export type OutreachGeneratorContent = {
  coldEmail: OutreachMessageBlock;
  linkedinMessage: OutreachMessageBlock;
  callScript: OutreachCallScript;
  voicemail: OutreachMessageBlock;
  followUp1: OutreachMessageBlock;
  followUp2: OutreachMessageBlock;
  followUp3: OutreachMessageBlock;
};

export type OutreachGeneratorRecord = {
  id: string;
  companyId: string;
  writingStyle: OutreachWritingStyle;
  contactId: string | null;
  contactName: string | null;
  primarySignalId: string | null;
  content: OutreachGeneratorContent;
  referencedSignalIds: string[];
  model: string | null;
  generatedAt: string;
};

export type OutreachGeneratorResponse = {
  generation: OutreachGeneratorRecord | null;
  availableStyles: OutreachWritingStyle[];
};

export function parseWritingStyle(value: string | null | undefined): OutreachWritingStyle {
  if (value && OUTREACH_WRITING_STYLES.includes(value as OutreachWritingStyle)) {
    return value as OutreachWritingStyle;
  }
  return "consultative";
}
