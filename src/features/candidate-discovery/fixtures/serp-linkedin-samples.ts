import type { AttributedSearchResult } from "@/features/candidate-discovery/domain/candidate-discovery.types";

export const SAMPLE_VACANCY_ID = "00000000-0000-4000-8000-000000000101";

export const sampleLinkedInSerpHits: AttributedSearchResult[] = [
  {
    title: "Lisa Jansen - Senior Frontend Developer | LinkedIn",
    url: "https://www.linkedin.com/in/lisa-jansen-dev",
    description:
      "Senior Frontend Developer in Utrecht. TypeScript, React, 8 jaar ervaring in SaaS.",
    sourceQuery: 'site:linkedin.com/in "Senior Software Engineer" Utrecht',
    sourceProvider: "tavily",
  },
  {
    title: "Jan de Vries - Product Manager | LinkedIn",
    url: "https://linkedin.com/in/jan-product",
    description: "Product Manager in Amsterdam — strategie en stakeholders.",
    sourceQuery: 'site:linkedin.com/in "Senior Software Engineer" Utrecht',
    sourceProvider: "tavily",
  },
  {
    title: "Senior Frontend Developer - Utrecht | LinkedIn",
    url: "https://www.linkedin.com/in/only-role-no-name",
    description: "TypeScript en React in Utrecht.",
    sourceQuery: 'site:linkedin.com/in "Senior Software Engineer" Utrecht',
    sourceProvider: "tavily",
  },
  {
    title: "Duplicate - Senior Frontend Developer",
    url: "https://www.linkedin.com/in/lisa-jansen-dev?utm=1",
    description: "TypeScript, React, Utrecht",
    sourceQuery: 'site:linkedin.com/in "Senior Software Engineer" Utrecht',
    sourceProvider: "serpapi",
  },
  {
    title: "ACME BV | LinkedIn",
    url: "https://www.linkedin.com/company/acme-bv",
    description: "Wij zoeken developers.",
    sourceQuery: "site:linkedin.com/in",
    sourceProvider: "tavily",
  },
];