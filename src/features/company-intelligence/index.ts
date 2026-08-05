export type {
  CompanyActivityItem,
  CompanyDigitalPresence,
  CompanyHiringSignalItem,
  CompanyNewsItem,
  CompanyOutreachItem,
  CompanyPageData,
  CompanyPageIntelligence,
  CompanyTaskItem,
  CompanyTimelineEvent,
  CompanyVacancyItem,
} from "@/features/company-intelligence/domain/company-page.types";
export { createCompanyPageService } from "@/features/company-intelligence/create-company-page-service";
export {
  assessRecruitmentPotentialFromCompany,
  assessRecruitmentPotentialFromContext,
  recruitmentPotentialLabel,
  type RecruitmentPotential,
  type RecruitmentPotentialAssessment,
} from "@/features/company-intelligence/services/recruitment-potential.service";
