import type {
  AtsCompanyInsight,
  QuietClientInsight,
  RecruitmentCallLead,
  RecruitmentCompanyInsight,
  RecruitmentInsightPeriod,
  RecruitmentRecruiterInsight,
  RecruitmentVacancyInsight,
  SimilarCompanyInsight,
  VacancyRoleInsight,
  WarmingLeadInsight,
} from "@/features/recruitment-assistant/domain/types";

export class RecruitmentAssistantRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecruitmentAssistantRepositoryError";
  }
}

export interface RecruitmentAssistantRepository {
  getTopGrowingCompanies(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<RecruitmentCompanyInsight[]>;

  getCompaniesWithNewVacancies(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<RecruitmentVacancyInsight[]>;

  getCompaniesHiringRecruiters(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<RecruitmentRecruiterInsight[]>;

  getLeadsToCallToday(organizationId: string, limit: number): Promise<RecruitmentCallLead[]>;

  findSimilarCompanies(
    organizationId: string,
    companyName: string,
    limit: number,
  ): Promise<{ referenceCompany: RecruitmentCompanyInsight | null; similar: SimilarCompanyInsight[] }>;

  getWarmingLeads(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
    minDelta?: number,
  ): Promise<WarmingLeadInsight[]>;

  getQuietClients(
    organizationId: string,
    limit: number,
    quietDays: number,
  ): Promise<QuietClientInsight[]>;

  getCompaniesByAts(
    organizationId: string,
    atsName: string,
    limit: number,
  ): Promise<AtsCompanyInsight[]>;

  getCompaniesByVacancyRole(
    organizationId: string,
    roleTitle: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<VacancyRoleInsight[]>;
}
