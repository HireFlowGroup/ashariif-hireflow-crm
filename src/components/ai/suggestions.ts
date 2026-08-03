export type CopilotSuggestion = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: "calls" | "growth" | "intel" | "search";
};

export const COPILOT_SUGGESTIONS: CopilotSuggestion[] = [
  {
    id: "leads-today",
    title: "Vandaag bellen",
    description: "Prioritaire leads met score, outreach en hiring activiteit.",
    prompt: "Welke bedrijven moet ik vandaag bellen? Geef een onderbouwd antwoord uit de database.",
    category: "calls",
  },
  {
    id: "warming-leads",
    title: "Warmer geworden",
    description: "Leads waarvan de score recent is gestegen.",
    prompt: "Welke leads zijn warmer geworden? Toon score-delta en bewijs per bedrijf.",
    category: "calls",
  },
  {
    id: "top-growing",
    title: "Snel groeiend",
    description: "Top op hiring intensity en signalen.",
    prompt: "Welke bedrijven groeien snel? Maak een top 25 met onderbouwing.",
    category: "growth",
  },
  {
    id: "quiet-clients",
    title: "Stilgevallen",
    description: "Eerder actieve klanten zonder recente signals.",
    prompt: "Welke klanten zijn stilgevallen? Geef dagen sinds laatste signaal.",
    category: "calls",
  },
  {
    id: "similar-afas",
    title: "Lijken op AFAS",
    description: "Vergelijkbare profielen op sector, score en intensity.",
    prompt: "Welke bedrijven lijken op AFAS? Gebruik alleen data uit HireFlow.",
    category: "intel",
  },
  {
    id: "ats-recruitee",
    title: "Recruitee ATS",
    description: "Bedrijven met Recruitee gedetecteerd in signals.",
    prompt: "Welke bedrijven gebruiken Recruitee? Toon bronbewijs per bedrijf.",
    category: "search",
  },
  {
    id: "role-accountmanager",
    title: "Accountmanagers",
    description: "Vacatures met accountmanager in de titel.",
    prompt: "Welke bedrijven zoeken accountmanagers? Groepeer op bedrijf met vacaturetitels.",
    category: "search",
  },
  {
    id: "new-vacancies",
    title: "Nieuwe vacatures",
    description: "Bedrijven met recente vacatures in HireFlow.",
    prompt: "Welke bedrijven hebben nieuwe vacatures? Top 25 met datums.",
    category: "growth",
  },
];

/** @deprecated Use COPILOT_SUGGESTIONS */
export type AiSuggestion = CopilotSuggestion;
/** @deprecated Use COPILOT_SUGGESTIONS */
export const AI_SUGGESTIONS = COPILOT_SUGGESTIONS;
