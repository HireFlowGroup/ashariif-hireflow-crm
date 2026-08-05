import { CandidateMatchingService } from "@/features/candidate-matching/services/candidate-matching.service";
import { createCandidatesServiceFromClient } from "@/features/candidates/create-candidates-service";
import { createVacanciesServiceFromClient } from "@/features/vacancies/create-vacancies-service";
import { createCompaniesServiceFromClient } from "@/features/companies/create-companies-service";
import { createClient } from "@/lib/supabase/server";

export async function createCandidateMatchingService(): Promise<CandidateMatchingService> {
  const client = await createClient();
  return new CandidateMatchingService(
    createVacanciesServiceFromClient(client),
    createCandidatesServiceFromClient(client),
    createCompaniesServiceFromClient(client),
  );
}
