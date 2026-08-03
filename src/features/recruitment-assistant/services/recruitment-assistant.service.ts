import type {
  AtsCompanyInsight,
  QuietClientInsight,
  RecruitmentCallLead,
  RecruitmentCompanyInsight,
  RecruitmentInsightPeriod,
  RecruitmentInsightResult,
  RecruitmentRecruiterInsight,
  RecruitmentVacancyInsight,
  SimilarCompanyInsight,
  VacancyRoleInsight,
  WarmingLeadInsight,
} from "@/features/recruitment-assistant/domain/types";
import type { RecruitmentAssistantRepository } from "@/features/recruitment-assistant/repositories/recruitment-assistant.repository";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 25;

export class RecruitmentAssistantService {
  constructor(private readonly repository: RecruitmentAssistantRepository) {}

  private clampLimit(limit?: number): number {
    if (!limit || limit < 1) return DEFAULT_LIMIT;
    return Math.min(limit, MAX_LIMIT);
  }

  async getTopGrowingCompanies(
    organizationId: string,
    options: { limit?: number; period?: RecruitmentInsightPeriod } = {},
  ): Promise<RecruitmentInsightResult<RecruitmentCompanyInsight>> {
    const limit = this.clampLimit(options.limit);
    const period = options.period ?? "30d";
    const items = await this.repository.getTopGrowingCompanies(organizationId, limit, period);

    return {
      query: "Top groeiende bedrijven op basis van hiring intensity en signalen",
      period,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "companies_intelligence + hiring_signals",
    };
  }

  async getCompaniesWithNewVacancies(
    organizationId: string,
    options: { limit?: number; period?: RecruitmentInsightPeriod } = {},
  ): Promise<RecruitmentInsightResult<RecruitmentVacancyInsight>> {
    const limit = this.clampLimit(options.limit);
    const period = options.period ?? "30d";
    const items = await this.repository.getCompaniesWithNewVacancies(organizationId, limit, period);

    return {
      query: "Bedrijven met nieuwe vacatures",
      period,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "vacancies + companies",
    };
  }

  async getCompaniesHiringRecruiters(
    organizationId: string,
    options: { limit?: number; period?: RecruitmentInsightPeriod } = {},
  ): Promise<RecruitmentInsightResult<RecruitmentRecruiterInsight>> {
    const limit = this.clampLimit(options.limit);
    const period = options.period ?? "30d";
    const items = await this.repository.getCompaniesHiringRecruiters(organizationId, limit, period);

    return {
      query: "Bedrijven die recruiters of HR managers zoeken",
      period,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "hiring_signals (new_recruiter, new_hr_manager)",
    };
  }

  async getLeadsToCallToday(
    organizationId: string,
    options: { limit?: number } = {},
  ): Promise<RecruitmentInsightResult<RecruitmentCallLead>> {
    const limit = this.clampLimit(options.limit);
    const items = await this.repository.getLeadsToCallToday(organizationId, limit);

    return {
      query: "Leads om vandaag te bellen",
      period: null,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "companies_intelligence (score, priority, outreach, signals)",
    };
  }

  async findSimilarCompanies(
    organizationId: string,
    companyName: string,
    options: { limit?: number } = {},
  ): Promise<{
    referenceCompany: RecruitmentCompanyInsight | null;
    similar: RecruitmentInsightResult<SimilarCompanyInsight>;
  }> {
    const limit = this.clampLimit(options.limit);
    const { referenceCompany, similar } = await this.repository.findSimilarCompanies(
      organizationId,
      companyName,
      limit,
    );

    return {
      referenceCompany,
      similar: {
        query: `Bedrijven vergelijkbaar met ${companyName}`,
        period: null,
        limit,
        total: similar.length,
        generatedAt: new Date().toISOString(),
        items: similar,
        dataSource: "companies_intelligence (sector, city, score, hiring intensity)",
      },
    };
  }

  async getWarmingLeads(
    organizationId: string,
    options: { limit?: number; period?: RecruitmentInsightPeriod; minDelta?: number } = {},
  ): Promise<RecruitmentInsightResult<WarmingLeadInsight>> {
    const limit = this.clampLimit(options.limit);
    const period = options.period ?? "30d";
    const items = await this.repository.getWarmingLeads(
      organizationId,
      limit,
      period,
      options.minDelta,
    );

    return {
      query: "Leads waarvan de score is gestegen (warmer geworden)",
      period,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "company_scores (score historie) + companies_intelligence",
    };
  }

  async getQuietClients(
    organizationId: string,
    options: { limit?: number; quietDays?: number } = {},
  ): Promise<RecruitmentInsightResult<QuietClientInsight>> {
    const limit = this.clampLimit(options.limit);
    const quietDays = options.quietDays ?? 21;
    const items = await this.repository.getQuietClients(organizationId, limit, quietDays);

    return {
      query: `Klanten zonder recente hiring activiteit (>${quietDays} dagen stil)`,
      period: null,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "companies_intelligence (last_signal_at, outreach, signal_count)",
    };
  }

  async getCompaniesByAts(
    organizationId: string,
    atsName: string,
    options: { limit?: number } = {},
  ): Promise<RecruitmentInsightResult<AtsCompanyInsight>> {
    const limit = this.clampLimit(options.limit);
    const items = await this.repository.getCompaniesByAts(organizationId, atsName, limit);

    return {
      query: `Bedrijven die ATS "${atsName}" gebruiken volgens hiring signals`,
      period: null,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "hiring_signals (ats_detected + ATS markers in bronnen)",
    };
  }

  async getCompaniesByVacancyRole(
    organizationId: string,
    roleTitle: string,
    options: { limit?: number; period?: RecruitmentInsightPeriod } = {},
  ): Promise<RecruitmentInsightResult<VacancyRoleInsight>> {
    const limit = this.clampLimit(options.limit);
    const period = options.period ?? "90d";
    const items = await this.repository.getCompaniesByVacancyRole(
      organizationId,
      roleTitle,
      limit,
      period,
    );

    return {
      query: `Bedrijven met vacatures voor rol "${roleTitle}"`,
      period,
      limit,
      total: items.length,
      generatedAt: new Date().toISOString(),
      items,
      dataSource: "vacancies (titel match) + companies",
    };
  }
}
