/** UI/API input for LinkedIn x-ray candidate sourcing (public SERP only). */
export type CandidateSourcingSearchCriteria = {
  vacancyId: string;
  jobTitle?: string;
  additionalJobTitles?: string[];
  location?: string;
  locationRadiusKm?: number;
  skills?: string[];
  experienceYearsMin?: number;
  industry?: string;
  keywords?: string[];
  naturalLanguageInstructions?: string;
};