export const AI_EMAIL_WRITER_SCHEMA_NAME = "ai_email_writer_draft";

export const AI_EMAIL_WRITER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string", description: "Onderwerpregel, kort en menselijk." },
    personal_introduction: { type: "string", description: "Persoonlijke introductie met aanhef." },
    observed_situation: { type: "string", description: "Waargenomen situatie op basis van analyse-feiten." },
    why_hireflow: { type: "string", description: "Waarom HireFlow kan helpen — geen kandidaten aanbieden." },
    call_to_action: { type: "string", description: "Eén eenvoudige CTA-vraag." },
    closing: { type: "string", description: "Afsluiting: Met vriendelijke groet, HireFlow Group" },
  },
  required: [
    "subject",
    "personal_introduction",
    "observed_situation",
    "why_hireflow",
    "call_to_action",
    "closing",
  ],
} as const;
