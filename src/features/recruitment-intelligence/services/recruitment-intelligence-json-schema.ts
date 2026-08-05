export const RECRUITMENT_INTELLIGENCE_SCHEMA_NAME = "recruitment_intelligence_analysis";

export const RECRUITMENT_INTELLIGENCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    company_summary: {
      type: "string",
      description: "Korte bedrijfscontext op basis van feiten. Exact 'Onvoldoende informatie.' als geen feiten.",
    },
    why_agency: {
      type: "string",
      description: "Waarom zou dit bedrijf een recruitmentbureau inschakelen? Alleen feiten. 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    likely_pain_points: {
      type: "string",
      description: "Welke pijn ervaren zij waarschijnlijk? 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    why_hireflow: {
      type: "string",
      description: "Waarom zouden ze HireFlow kiezen? Alleen op basis van feiten over hun situatie. 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    hard_to_fill_roles: {
      type: "string",
      description: "Welke functies zijn het moeilijkst te vervullen? Baseer op vacaturetitels/signalen. 'Onvoldoende informatie.' indien onbekend.",
    },
    urgency_rationale: {
      type: "string",
      description: "Hoe dringend is hun behoefte? Tekst op basis van feiten. 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    opportunity_chance_rationale: {
      type: "string",
      description: "Wat is de kans op een opdracht? Tekst op basis van feiten. 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    likely_decision_maker: {
      type: "string",
      description: "Contactpersoon met meeste beslissingsbevoegdheid uit contacten. 'Onvoldoende informatie.' indien geen contacten.",
    },
    opening_line: {
      type: "string",
      description: "Beste openingszin voor outreach op basis van feiten. 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    recommended_cta: {
      type: "string",
      description: "Beste call-to-action — één concrete vraag. 'Onvoldoende informatie.' indien niet afleidbaar.",
    },
    urgency_score: {
      type: ["integer", "null"],
      minimum: 0,
      maximum: 100,
      description: "Urgentie 0-100 op basis van feiten. null als onvoldoende informatie.",
    },
    recruitment_opportunity_score: {
      type: ["integer", "null"],
      minimum: 0,
      maximum: 100,
      description: "Recruitment Opportunity Score 0-100. null als onvoldoende informatie. NOoit gokken.",
    },
    opportunity_tier: {
      type: ["string", "null"],
      enum: ["warm", "interessant", "lage_kans", null],
      description: "warm >=70, interessant >=40, lage_kans <40. null als score null.",
    },
  },
  required: [
    "company_summary",
    "why_agency",
    "likely_pain_points",
    "why_hireflow",
    "hard_to_fill_roles",
    "urgency_rationale",
    "opportunity_chance_rationale",
    "likely_decision_maker",
    "opening_line",
    "recommended_cta",
    "urgency_score",
    "recruitment_opportunity_score",
    "opportunity_tier",
  ],
} as const;
