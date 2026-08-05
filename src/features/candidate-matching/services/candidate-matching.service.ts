import type { CandidateId } from "@/features/candidates/domain";
import type {
  CandidateMatchInput,
  CandidateVacancyMatch,
} from "@/features/candidate-matching/domain/match.types";
import { candidateVacancyMatchSchema } from "@/features/candidate-matching/domain/match.types";
import { generateCandidateIntroduction } from "@/features/candidate-matching/services/candidate-intro-generator.service";
import {
  computeCandidateMatch,
  toCandidateMatchInput,
} from "@/features/candidate-matching/services/candidate-matcher.service";
import type { CandidatesService } from "@/features/candidates/services/candidates.service";
import type { VacanciesService } from "@/features/vacancies/services/vacancies.service";
import type { VacancyId } from "@/features/vacancies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";

export type MatchCandidateToVacancyInput = {
  vacancyId: VacancyId;
  candidateId?: CandidateId;
  candidate?: CandidateMatchInput;
  companyName?: string | null;
};

export type MatchServiceContext = {
  organizationId: string;
  userId: string;
};

export class CandidateMatchingService {
  constructor(
    private readonly vacanciesService: VacanciesService,
    private readonly candidatesService: CandidatesService,
    private readonly companiesService: CompaniesService,
  ) {}

  async matchCandidateToVacancy(
    context: MatchServiceContext,
    input: MatchCandidateToVacancyInput,
  ): Promise<CandidateVacancyMatch> {
    const vacancy = await this.vacanciesService.getVacancy(context, input.vacancyId);

    let candidateInput: CandidateMatchInput;
    if (input.candidate) {
      candidateInput = input.candidate;
    } else if (input.candidateId) {
      const profile = await this.candidatesService.getCandidate(context, input.candidateId);
      candidateInput = toCandidateMatchInput(profile);
    } else {
      throw new Error("Geef candidateId of candidate-profiel op.");
    }

    let companyName = input.companyName ?? null;
    if (!companyName) {
      try {
        const company = await this.companiesService.getCompany(context, vacancy.companyId);
        companyName = company.name;
      } catch {
        companyName = null;
      }
    }

    const match = computeCandidateMatch(vacancy, candidateInput);
    const introduction = await generateCandidateIntroduction(
      vacancy,
      candidateInput,
      match,
      companyName,
    );

    return candidateVacancyMatchSchema.parse({
      vacancyId: vacancy.id,
      vacancyTitle: vacancy.title,
      candidateName: `${candidateInput.firstName} ${candidateInput.lastName}`,
      match,
      introduction,
    });
  }
}
