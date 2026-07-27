export type AiSuggestion = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export const AI_SUGGESTIONS: AiSuggestion[] = [
  {
    id: "vacancy",
    title: "Vacature analyseren",
    description: "Maak een zoekprofiel en interviewrichting.",
    prompt:
      "Ik heb een vacature. Help me met een zoekprofiel, must-haves en eerste interviewvragen.",
  },
  {
    id: "outreach",
    title: "Acquisitie opstellen",
    description: "Schrijf een korte, professionele benadering.",
    prompt:
      "Schrijf een acquisitiemail voor een logistiek bedrijf in Rotterdam. Houd het kort en concreet.",
  },
  {
    id: "planning",
    title: "Dagplanning",
    description: "Structuur voor opvolging en prioriteiten.",
    prompt:
      "Help me mijn werkdag plannen: leads opvolgen, kandidaten bellen en vacatures bijwerken.",
  },
  {
    id: "interview",
    title: "Interviewvragen",
    description: "Gerichte vragen voor een functiegesprek.",
    prompt:
      "Geef interviewvragen voor een senior accountmanager in B2B sales, inclusief gedragsvragen.",
  },
];
