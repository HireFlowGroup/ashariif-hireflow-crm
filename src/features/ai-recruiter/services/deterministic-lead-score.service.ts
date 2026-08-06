import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { scoreMailboxPrefix } from "@/features/contact-finder/domain/contact-role-priority";
import { matchContactRole } from "@/features/contact-finder/domain/contact-role-priority";

export type DeterministicLeadScoreResult = {
  score: number;
  priority: "priority_a" | "priority_b" | "priority_c" | "low_priority" | "reject";
  breakdown: {
    vacancyIntent: number;
    companyFit: number;
    contactability: number;
    urgency: number;
  };
  acceptedRules: string[];
  rejectedRules: string[];
};

function locationMatches(company: Company, plan: AiRecruiterSearchPlan): boolean {
  if (plan.locations.length === 0 && plan.regions.length === 0) return true;
  if (!company.city && !company.region) return true;
  const city = (company.city ?? "").toLowerCase();
  const region = (company.region ?? "").toLowerCase();
  return (
    plan.locations.some((loc) => city.includes(loc.toLowerCase()))
    || plan.regions.some((reg) => region.includes(reg.toLowerCase()) || city.includes(reg.toLowerCase()))
  );
}

function sectorMatches(company: Company, plan: AiRecruiterSearchPlan): boolean {
  if (plan.sectors.length === 0) return true;
  if (!company.sector) return true;
  const sector = company.sector.toLowerCase();
  return plan.sectors.some((s) => sector.includes(s.toLowerCase()));
}

function employeeRangeMatches(company: Company, plan: AiRecruiterSearchPlan): boolean {
  const { min, max } = plan.employee_range;
  if (min === null && max === null) return true;
  const companyMin = company.employeeCountMin;
  const companyMax = company.employeeCountMax;
  if (companyMin === null && companyMax === null) return true;
  const effectiveMin = companyMin ?? companyMax ?? 0;
  const effectiveMax = companyMax ?? companyMin ?? 9999;
  const planMin = min ?? 0;
  const planMax = max ?? 9999;
  return effectiveMax >= planMin && effectiveMin <= planMax;
}

function scoreContactability(contact: SelectedDiscoveredContact | null): {
  score: number;
  rule: string | null;
} {
  if (!contact?.email) return { score: 0, rule: null };

  if (!contact.isGeneralMailbox) {
    const role = matchContactRole(contact.jobTitle);
    if (role && role.score >= 70) {
      return { score: 20, rule: "personal_hr_recruitment_contact" };
    }
    return { score: 18, rule: "personal_contact" };
  }

  const local = contact.email.split("@")[0]?.toLowerCase() ?? "";
  const prefixScore = scoreMailboxPrefix(local);

  if (/^(recruitment|hr|talent|careers|jobs|vacatures|werkenbij)/.test(local)) {
    return { score: 12, rule: "relevant_general_mailbox" };
  }
  if (/^(info|contact|hello)/.test(local)) {
    return { score: 7, rule: "info_or_contact_mailbox" };
  }
  if (prefixScore >= 50) {
    return { score: 10, rule: "general_mailbox" };
  }

  return { score: 5, rule: "fallback_mailbox" };
}

export function computeDeterministicLeadScore(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  vacancies: VacancyEvidence[];
  vacancyCount: number;
  hiringScore: number;
  contact: SelectedDiscoveredContact | null;
  desiredRoleMatch: boolean;
}): DeterministicLeadScoreResult {
  const acceptedRules: string[] = [];
  const rejectedRules: string[] = [];

  let vacancyIntent = 0;
  const activeVacancies = input.vacancies.filter((v) => v.isActive);

  if (activeVacancies.length > 0 || input.vacancyCount > 0) {
    vacancyIntent += 20;
    acceptedRules.push("active_vacancy_found");
  } else if (input.vacancies.length > 0) {
    vacancyIntent += 12;
    acceptedRules.push("plausible_vacancy_found");
  }

  if (input.vacancyCount > 1 || activeVacancies.length > 1) {
    vacancyIntent += 10;
    acceptedRules.push("multiple_vacancies");
  }

  if (input.desiredRoleMatch) {
    vacancyIntent += 5;
    acceptedRules.push("relevant_focus_role");
  }

  vacancyIntent = Math.min(35, vacancyIntent);

  let companyFit = 0;
  if (locationMatches(input.company, input.plan)) {
    companyFit += 10;
    acceptedRules.push("location_match");
  } else {
    rejectedRules.push("wrong_location");
  }

  if (sectorMatches(input.company, input.plan)) {
    companyFit += 10;
    acceptedRules.push("sector_match");
  } else if (input.plan.sectors.length > 0) {
    rejectedRules.push("wrong_sector");
  }

  if (employeeRangeMatches(input.company, input.plan)) {
    companyFit += 5;
    acceptedRules.push("employee_range_match");
  }

  companyFit = Math.min(25, companyFit);

  const contactabilityResult = scoreContactability(input.contact);
  let contactability = contactabilityResult.score;
  if (contactabilityResult.rule) {
    acceptedRules.push(contactabilityResult.rule);
  }
  if (!input.contact?.email) {
    rejectedRules.push("no_contact");
  }
  contactability = Math.min(20, contactability);

  let urgency = 0;
  const recentVacancy = activeVacancies.find((v) => v.actuality === "known");
  if (recentVacancy) {
    urgency += 8;
    acceptedRules.push("recent_vacancy");
  } else if (activeVacancies.length > 0) {
    urgency += 4;
    acceptedRules.push("vacancy_actuality_unknown");
  }

  if (activeVacancies.length > 1) urgency += 6;
  if (input.hiringScore >= 50) urgency += 3;

  urgency = Math.min(20, urgency);

  const score = vacancyIntent + companyFit + contactability + urgency;

  let priority: DeterministicLeadScoreResult["priority"];
  if (score >= 80) priority = "priority_a";
  else if (score >= 60) priority = "priority_b";
  else if (score >= 30) priority = "priority_c";
  else if (score >= 1) priority = "low_priority";
  else priority = "reject";

  return {
    score,
    priority,
    breakdown: { vacancyIntent, companyFit, contactability, urgency },
    acceptedRules,
    rejectedRules,
  };
}

export function priorityLabel(priority: DeterministicLeadScoreResult["priority"]): string {
  switch (priority) {
    case "priority_a":
      return "Priority A";
    case "priority_b":
      return "Priority B";
    case "priority_c":
      return "Priority C";
    case "low_priority":
      return "Lage prioriteit";
    case "reject":
      return "Afgewezen";
  }
}
