export type AiSuggestion = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export const AI_SUGGESTIONS: AiSuggestion[] = [
  {
    id: "company-create",
    title: "Bedrijf aanmaken",
    description: "Nieuw CRM-bedrijf via de assistent.",
    prompt:
      "Maak een bedrijf aan met de naam HireFlow BV, sector software, website https://hireflow.example.",
  },
  {
    id: "company-list",
    title: "Bedrijvenlijst",
    description: "Actieve bedrijven in je organisatie.",
    prompt: "Laat alle actieve bedrijven zien.",
  },
  {
    id: "company-search",
    title: "Bedrijf zoeken",
    description: "Zoek op naam of klant.",
    prompt: "Zoek alle klanten met HireFlow in de naam.",
  },
  {
    id: "company-open",
    title: "Bedrijf openen",
    description: "Details na zoeken.",
    prompt: "Zoek bedrijf HireFlow en toon daarna de volledige bedrijfsinformatie.",
  },
  {
    id: "company-update",
    title: "Bedrijf bijwerken",
    description: "Telefoon, website of notities.",
    prompt: "Zoek HireFlow en werk het telefoonnummer bij naar +31 20 123 4567.",
  },
  {
    id: "company-archive",
    title: "Archiveren",
    description: "Bedrijf inactief zetten.",
    prompt:
      "Zoek bedrijf HireFlow en archiveer het met reden: geen actieve samenwerking meer.",
  },
];
