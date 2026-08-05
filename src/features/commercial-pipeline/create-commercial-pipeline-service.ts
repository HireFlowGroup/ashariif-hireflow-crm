import { createClient } from "@/lib/supabase/server";
import { CommercialPipelineService } from "@/features/commercial-pipeline/services/commercial-pipeline.service";
import { SupabaseCommercialPipelineRepository } from "@/features/commercial-pipeline/repositories/supabase-commercial-pipeline.repository";

export async function createCommercialPipelineService(): Promise<CommercialPipelineService> {
  const client = await createClient();

  const repository = new SupabaseCommercialPipelineRepository(client);

  const loadCompany = async (organizationId: string, companyId: string) => {
    const { data, error } = await client
      .from("companies")
      .select("id, name, sector, city, lead_score, general_email, hr_email")
      .eq("organization_id", organizationId)
      .eq("id", companyId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      sector: data.sector,
      city: data.city,
      contactName: null,
      contactEmail: data.hr_email ?? data.general_email ?? null,
      leadScore: data.lead_score,
    };
  };

  return new CommercialPipelineService(repository, loadCompany);
}
