import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ManagedProviderId,
  ProviderConfigRecord,
  ProviderHealthRecord,
  ProviderSecrets,
} from "@/features/provider-vault/shared/domain/provider-definitions";
import {
  buildMaskedPreview,
  decryptSecrets,
  encryptSecrets,
  fingerprintSecrets,
} from "@/features/provider-vault/server/encryption.service";

type ConfigRow = {
  id: string;
  organization_id: string;
  provider_id: string;
  enabled: boolean;
  encrypted_payload: string;
  secret_fingerprint: string;
  masked_preview: string | null;
  updated_by: string | null;
  updated_at: string;
};

type HealthRow = {
  provider_id: string;
  status: string;
  health_score: number;
  requests_today: number;
  success_rate: number;
  avg_response_ms: number;
  quota_remaining: number | null;
  last_error: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  updated_at: string;
};

export class ProviderVaultRepositoryError extends Error {
  constructor(
    message: string,
    readonly supabaseCode?: string,
  ) {
    super(message);
    this.name = "ProviderVaultRepositoryError";
  }
}

function mapConfigRow(row: ConfigRow): ProviderConfigRecord {
  let secrets: ProviderSecrets = {};

  try {
    secrets = decryptSecrets(row.encrypted_payload);
  } catch {
    secrets = {};
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    providerId: row.provider_id as ManagedProviderId,
    enabled: row.enabled,
    secrets,
    maskedPreview: row.masked_preview,
    secretFingerprint: row.secret_fingerprint,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function mapHealthRow(row: HealthRow): ProviderHealthRecord {
  return {
    providerId: row.provider_id as ManagedProviderId,
    status: row.status as ProviderHealthRecord["status"],
    healthScore: row.health_score,
    requestsToday: row.requests_today,
    successRate: row.success_rate,
    avgResponseMs: row.avg_response_ms,
    quotaRemaining: row.quota_remaining,
    lastError: row.last_error,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseProviderVaultRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listConfigs(organizationId: string): Promise<ProviderConfigRecord[]> {
    const { data, error } = await this.client
      .from("organization_provider_configs")
      .select("*")
      .eq("organization_id", organizationId);

    if (error) {
      throw new ProviderVaultRepositoryError(error.message, error.code);
    }

    return (data as ConfigRow[]).map(mapConfigRow);
  }

  async upsertConfig(input: {
    organizationId: string;
    providerId: ManagedProviderId;
    enabled: boolean;
    secrets: ProviderSecrets;
    updatedBy: string;
  }): Promise<ProviderConfigRecord> {
    const encryptedPayload = encryptSecrets(input.secrets);
    const fingerprint = fingerprintSecrets(input.secrets);
    const maskedPreview = buildMaskedPreview(input.secrets);

    const { data, error } = await this.client
      .from("organization_provider_configs")
      .upsert(
        {
          organization_id: input.organizationId,
          provider_id: input.providerId,
          enabled: input.enabled,
          encrypted_payload: encryptedPayload,
          secret_fingerprint: fingerprint,
          masked_preview: maskedPreview,
          updated_by: input.updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new ProviderVaultRepositoryError(error.message, error.code);
    }

    return mapConfigRow(data as ConfigRow);
  }

  async deleteConfig(organizationId: string, providerId: ManagedProviderId): Promise<void> {
    const { error } = await this.client
      .from("organization_provider_configs")
      .delete()
      .eq("organization_id", organizationId)
      .eq("provider_id", providerId);

    if (error) {
      throw new ProviderVaultRepositoryError(error.message, error.code);
    }
  }

  async listHealth(organizationId: string): Promise<ProviderHealthRecord[]> {
    const { data, error } = await this.client
      .from("organization_provider_health")
      .select("*")
      .eq("organization_id", organizationId);

    if (error) {
      throw new ProviderVaultRepositoryError(error.message, error.code);
    }

    return (data as HealthRow[]).map(mapHealthRow);
  }

  async upsertHealth(
    organizationId: string,
    providerId: ManagedProviderId,
    health: Omit<ProviderHealthRecord, "providerId" | "updatedAt">,
  ): Promise<ProviderHealthRecord> {
    const { data, error } = await this.client
      .from("organization_provider_health")
      .upsert(
        {
          organization_id: organizationId,
          provider_id: providerId,
          status: health.status,
          health_score: health.healthScore,
          requests_today: health.requestsToday,
          success_rate: health.successRate,
          avg_response_ms: health.avgResponseMs,
          quota_remaining: health.quotaRemaining,
          last_error: health.lastError,
          last_success_at: health.lastSuccessAt,
          last_failure_at: health.lastFailureAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new ProviderVaultRepositoryError(error.message, error.code);
    }

    return mapHealthRow(data as HealthRow);
  }
}
