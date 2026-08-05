/** OpenAI Structured Outputs schema for AI Recruiter search plans (strict mode). */
export const AI_RECRUITER_SEARCH_PLAN_SCHEMA_NAME = "ai_recruiter_search_plan";

export const AI_RECRUITER_SEARCH_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    locations: {
      type: "array",
      items: { type: "string" },
      description: "Steden/plaatsen expliciet genoemd in de prompt.",
    },
    regions: {
      type: "array",
      items: { type: "string" },
      description: "Provincies/regio's expliciet genoemd.",
    },
    sectors: {
      type: "array",
      items: { type: "string" },
      description: "Sectoren/branches expliciet genoemd.",
    },
    employee_range: {
      type: "object",
      additionalProperties: false,
      properties: {
        min: {
          type: ["integer", "null"],
          description: "Minimum medewerkers. Null als niet genoemd.",
        },
        max: {
          type: ["integer", "null"],
          description: "Maximum medewerkers. Null als niet genoemd.",
        },
      },
      required: ["min", "max"],
    },
    desired_roles: {
      type: "array",
      items: { type: "string" },
      description: "Functierollen die bedrijven zoeken (recruiters, planners, etc.).",
    },
    vacancy_required: {
      type: "boolean",
      description: "True als vacatures expliciet vereist zijn.",
    },
    minimum_hiring_score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Minimum hiring score drempel. Default 70 voor commerciële opdrachtgever-acquisitie.",
    },
    minimum_opportunity_score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Minimum Opportunity Score (0-100) voor outreach. Default 70 — alleen sterke opdrachtgevers.",
    },
    maximum_companies: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      description: "Max aantal bedrijven. Gebruik 25 als niet expliciet genoemd.",
    },
    maximum_drafts: {
      type: "integer",
      minimum: 0,
      maximum: 50,
      description: 'Max concept-emails. Gebruik 10 als niet genoemd (bijv. "beste 10").',
    },
    contact_roles: {
      type: "array",
      items: { type: "string" },
      description: "Doel-contactrollen in prioriteit: HR Manager, Recruiter, TA, HRBP, Teamlead Recruitment, Directeur.",
    },
    outreach_mode: {
      type: "string",
      enum: ["draft_only", "manual_send", "automatic"],
      description: 'Altijd "draft_only" tenzij automatisch verzenden expliciet gevraagd.',
    },
    approval_mode: {
      type: "string",
      enum: ["manual", "automatic"],
      description: 'Altijd "manual" tenzij expliciet anders.',
    },
    exclusions: {
      type: "array",
      items: { type: "string" },
      description: "Uit te sluiten bedrijven of sectoren.",
    },
    uncertainties: {
      type: "array",
      items: { type: "string" },
      description: "Velden die onduidelijk of niet afleidbaar waren uit de prompt.",
    },
    reasoning: {
      type: "string",
      description: "Korte NL uitleg (2-4 zinnen) wat is afgeleid uit de prompt.",
    },
  },
  required: [
    "locations",
    "regions",
    "sectors",
    "employee_range",
    "desired_roles",
    "vacancy_required",
    "minimum_hiring_score",
    "minimum_opportunity_score",
    "maximum_companies",
    "maximum_drafts",
    "contact_roles",
    "outreach_mode",
    "approval_mode",
    "exclusions",
    "uncertainties",
    "reasoning",
  ],
} as const;
