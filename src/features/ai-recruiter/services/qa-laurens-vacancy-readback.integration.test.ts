/**
 * Laurens CRM vacancy evidence read-back — geen betaalde discovery-API's.
 * QA_TEST_* + bestaande werkgever in testproject.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { assessVacancyEvidence } from "@/features/ai-recruiter/services/company-vacancy-validation.service";
import { buildDiscoveryVacancyEvidenceFromCompany } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";

const LAURENS_VACANCY = "https://werkenbij.laurens.nl/vacature/corporate-recruiter/";
const ENABLED = Boolean(process.env.QA_TEST_EMAIL && process.env.QA_TEST_PASSWORD);

const plan: AiRecruiterSearchPlan = {
  locations: ["Nederland"],
  regions: [],
  sectors: ["zorg"],
  employee_range: { min: 20, max: 500 },
  desired_roles: ["Corporate Recruiter"],
  vacancy_required: true,
  minimum_hiring_score: 70,
  minimum_opportunity_score: 70,
  maximum_companies: 1,
  maximum_drafts: 1,
  contact_roles: ["HR Manager", "Recruitment Manager"],
  outreach_mode: "draft_only",
  approval_mode: "manual",
  exclusions: [],
  uncertainties: [],
  reasoning: "Laurens targeted read-back",
};

async function signIn(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.QA_TEST_EMAIL!,
    password: process.env.QA_TEST_PASSWORD!,
  });
  if (error || !data.user) throw new Error(error?.message ?? "login failed");
  return client;
}

function rowToCompany(row: Record<string, unknown>, organizationId: string): Company {
  return {
    id: toCompanyId(row.id as string),
    organizationId,
    ownerId: (row.owner_id as string | null) ?? null,
    name: row.name as string,
    website: (row.website as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    linkedinUrl: (row.linkedin_url as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    sector: (row.sector as string | null) ?? (row.industry as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    country: (row.country as string | null) ?? "NL",
    employeeCount: (row.employee_count as number | null) ?? null,
    employeeCountMin: (row.employee_count_min as number | null) ?? null,
    employeeCountMax: (row.employee_count_max as number | null) ?? null,
    employeeCountLabel: (row.employee_count_label as string | null) ?? null,
    priority: (row.priority as Company["priority"]) ?? null,
    leadScore: (row.lead_score as number | null) ?? null,
    leadPriority: (row.priority as Company["leadPriority"]) ?? null,
    scoreReason: (row.score_reason as string | null) ?? null,
    scoreBreakdown: (row.score_breakdown as Company["scoreBreakdown"]) ?? null,
    vacancyCount: (row.vacancy_count as number | null) ?? 0,
    hiringSignals: (row.hiring_signals as Company["hiringSignals"]) ?? [],
    careersUrl: (row.careers_url as string | null) ?? null,
    vacancyPageUrl: (row.vacancy_page_url as string | null) ?? null,
    generalEmail: (row.general_email as string | null) ?? null,
    hrEmail: (row.hr_email as string | null) ?? null,
    kvkNumber: (row.kvk_number as string | null) ?? null,
    aiSummary: (row.ai_summary as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    confidence: (row.confidence as number | null) ?? null,
    companyType: (row.company_type as string | null) ?? null,
    companyConfidence: (row.company_confidence as number | null) ?? null,
    discoveryReason: (row.discovery_reason as string | null) ?? null,
    discoveryProvider: (row.discovery_provider as string | null) ?? null,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
    outreachStatus: (row.outreach_status as Company["outreachStatus"]) ?? "none",
    status: (row.status as Company["status"]) ?? "prospect",
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  };
}

describe.runIf(ENABLED)("Laurens vacancy read-back (existing employer)", () => {
  it("persisteert verifieerbare vacature-URL op bestaande Laurens-record", async () => {
    const client = await signIn();
    const userId = (await client.auth.getUser()).data.user!.id;
    const { data: profile } = await client
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();
    const organizationId = profile!.organization_id as string;
    const ctx = { organizationId, userId };

    const { data: rows } = await client
      .from("companies")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("name", "Laurens%")
      .order("updated_at", { ascending: false })
      .limit(1);

    const companyId = rows?.[0]?.id as string | undefined;
    expect(companyId).toBeTruthy();

    const companiesService = await createCompaniesServiceWithWriteClient(client);
    await companiesService.updateCompany(ctx, toCompanyId(companyId!), {
      vacancyPageUrl: LAURENS_VACANCY,
      vacancyCount: 1,
      hiringSignals: [
        {
          type: "active_vacancy",
          description: "Corporate Recruiter",
          source: "qa_readback",
          confidence: 0.9,
        },
      ],
    });

    const { data: row } = await client
      .from("companies")
      .select("*")
      .eq("id", companyId!)
      .single();

    expect(row?.vacancy_page_url).toBe(LAURENS_VACANCY);

    const company = rowToCompany(row as Record<string, unknown>, organizationId);
    const discoveryEvidence = buildDiscoveryVacancyEvidenceFromCompany(company, plan);
    expect(discoveryEvidence.length).toBeGreaterThanOrEqual(1);
    expect(discoveryEvidence[0]?.desiredRoleMatch).toBe(true);

    const validation = assessVacancyEvidence({
      company,
      plan,
      parsedVacancies: [],
      preservedDiscoveryEvidence: discoveryEvidence,
      evidenceSource: "discovery_classification",
    });

    expect(validation.status).not.toBe("no_matching_role");
    expect(validation.vacancies.some((v) => v.desiredRoleMatch)).toBe(true);
  });
});