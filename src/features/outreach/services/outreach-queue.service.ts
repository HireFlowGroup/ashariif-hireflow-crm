import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "@/features/companies/domain";
import { toCompanyId } from "@/features/companies/domain";

export type OutreachQueueItem = {
  id: string;
  organizationId: string;
  companyId: string;
  userId: string;
  suggestedContactRole: string | null;
  outreachAngle: string | null;
  status: "draft" | "review" | "approved" | "sent" | "cancelled" | "blocked";
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateOutreachQueueInput = {
  companyId: string;
  suggestedContactRole?: string;
  outreachAngle?: string;
};

export class OutreachQueueRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachQueueRepositoryError";
  }
}

export class OutreachQueueServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachQueueServiceError";
  }
}

export class OutreachQueueService {
  constructor(private readonly client: SupabaseClient) {}

  async queueCompany(
    organizationId: string,
    userId: string,
    company: Company,
  ): Promise<OutreachQueueItem> {
    if (company.outreachStatus === "blocked" || company.outreachStatus === "sent") {
      throw new OutreachQueueServiceError("Bedrijf is geblokkeerd of al benaderd.");
    }

    if (!company.domain && !company.email && !company.website) {
      throw new OutreachQueueServiceError(
        "Geen geldig bedrijfsdomein of zakelijk e-mailadres beschikbaar.",
      );
    }

    if (!company.source) {
      throw new OutreachQueueServiceError("Bronvermelding ontbreekt voor dit bedrijf.");
    }

    if ((company.leadScore ?? 0) < 50) {
      throw new OutreachQueueServiceError("Leadscore is onvoldoende (minimaal 50 vereist).");
    }

    const { data: existing } = await this.client
      .from("outreach")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("company_id", company.id as string)
      .in("status", ["draft", "review", "approved", "queued"])
      .maybeSingle();

    if (existing) {
      throw new OutreachQueueServiceError("Er bestaat al een actieve outreach voor dit bedrijf.");
    }

    const outreachAngle = buildOutreachAngle(company);

    const { data, error } = await this.client
      .from("outreach")
      .insert({
        organization_id: organizationId,
        company_id: company.id as string,
        user_id: userId,
        suggested_contact_role: suggestContactRole(company),
        outreach_angle: outreachAngle,
        status: "queued",
        review_required: true,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new OutreachQueueRepositoryError("Outreach queue item kon niet worden aangemaakt.");
    }

    await this.client
      .from("companies")
      .update({ outreach_status: "queued", updated_at: new Date().toISOString() })
      .eq("id", company.id as string)
      .eq("organization_id", organizationId);

    return mapRow(data);
  }
}

function suggestContactRole(company: Company): string {
  if (company.vacancyCount > 0) return "HR Manager / Recruiter";
  if (company.sector?.toLowerCase().includes("software")) return "Office Manager";
  return "Directeur / Eigenaar";
}

function buildOutreachAngle(company: Company): string {
  if (company.vacancyCount > 0) {
    return `HireFlow kan ondersteunen bij ${company.vacancyCount} openstaande vacature(s) bij ${company.name}.`;
  }

  if (company.leadPriority === "A") {
    return `${company.name} scoort hoog op branche- en regio-match — geschikt voor proactieve outreach.`;
  }

  return `Prospect in ${company.sector ?? "onbekende sector"} — verken samenwerking met HireFlow.`;
}

function mapRow(row: Record<string, unknown>): OutreachQueueItem {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    companyId: row.company_id as string,
    userId: row.user_id as string,
    suggestedContactRole: (row.suggested_contact_role as string) ?? null,
    outreachAngle: (row.outreach_angle as string) ?? null,
    status: row.status as OutreachQueueItem["status"],
    reviewRequired: row.review_required as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export { toCompanyId };
