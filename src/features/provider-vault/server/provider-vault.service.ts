import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getManagedProvider,
  MANAGED_PROVIDERS,
  type ManagedProviderId,
  type ProviderHealthRecord,
  type ProviderSecrets,
  type ProviderSettingsSnapshot,
} from "@/features/provider-vault/shared/domain/provider-definitions";
import { SupabaseProviderVaultRepository } from "@/features/provider-vault/server/repositories/supabase-provider-vault.repository";
import {
  clearOrgCredentialCache,
  loadOrgCredentialsIntoCache,
  removeOrgProviderCredentials,
  setOrgProviderCredentials,
} from "@/features/provider-vault/server/credential-cache.service";
import { firstEnvKey } from "@/features/lead-intelligence/providers/manager/provider-env";
import {
  getProviderRuntimeStats,
  resetProviderStats,
} from "@/features/lead-intelligence/providers/manager/provider-stats.store";
import { clearProviderCache } from "@/features/lead-intelligence/providers/manager/provider-cache";

export class ProviderVaultServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderVaultServiceError";
  }
}

function resolveEnvSecrets(providerId: ManagedProviderId): ProviderSecrets | null {
  const definition = getManagedProvider(providerId);
  if (!definition) return null;

  if (providerId === "google-cse") {
    const apiKey = firstEnvKey("GOOGLE_CSE_API_KEY");
    const cx = firstEnvKey("GOOGLE_CSE_CX");
    if (!apiKey || !cx) return null;
    return { apiKey, cx };
  }

  const apiKey = firstEnvKey(...definition.envFallbackKeys);
  if (!apiKey) return null;

  return { apiKey };
}

function hasRequiredSecrets(
  providerId: ManagedProviderId,
  secrets: ProviderSecrets,
): boolean {
  const definition = getManagedProvider(providerId);
  if (!definition) return false;

  return definition.secretFields
    .filter((field) => field.required)
    .every((field) => Boolean(secrets[field.key]?.trim()));
}

export class ProviderVaultService {
  constructor(private readonly repository: SupabaseProviderVaultRepository) {}

  async warmOrganizationCache(organizationId: string): Promise<void> {
    const configs = await this.repository.listConfigs(organizationId);

    loadOrgCredentialsIntoCache(
      organizationId,
      configs.map((config) => ({
        providerId: config.providerId,
        enabled: config.enabled,
        secrets: config.secrets,
        fingerprint: config.secretFingerprint,
        maskedPreview: config.maskedPreview,
      })),
    );
  }

  async getProviderSnapshots(organizationId: string): Promise<ProviderSettingsSnapshot[]> {
    await this.warmOrganizationCache(organizationId);

    const [configs, healthRows] = await Promise.all([
      this.repository.listConfigs(organizationId),
      this.repository.listHealth(organizationId),
    ]);

    const configByProvider = new Map(configs.map((config) => [config.providerId, config]));
    const healthByProvider = new Map(healthRows.map((health) => [health.providerId, health]));

    return MANAGED_PROVIDERS.map((definition) => {
      const vaultConfig = configByProvider.get(definition.id);
      const envSecrets = resolveEnvSecrets(definition.id);
      const vaultConfigured = vaultConfig ? hasRequiredSecrets(definition.id, vaultConfig.secrets) : false;
      const envConfigured = envSecrets ? hasRequiredSecrets(definition.id, envSecrets) : false;
      const configured = vaultConfigured || envConfigured;

      let secretSource: ProviderSettingsSnapshot["secretSource"] = "none";
      if (vaultConfigured) secretSource = "vault";
      else if (envConfigured) secretSource = "env";

      const enabled = vaultConfig?.enabled ?? true;
      const runtime = getProviderRuntimeStats(definition.id, configured && enabled);

      const persisted = healthByProvider.get(definition.id);

      const status = !configured || !enabled
        ? "disabled" as const
        : persisted?.status ?? runtime.status;

      return {
        id: definition.id,
        name: definition.name,
        category: definition.category,
        description: definition.description,
        secretFields: definition.secretFields,
        enabled,
        configured,
        secretSource,
        maskedPreview: vaultConfig?.maskedPreview ?? (envConfigured ? "•••• (env)" : null),
        status,
        healthScore: persisted?.healthScore ?? runtime.healthScore,
        avgResponseMs: persisted?.avgResponseMs ?? runtime.avgResponseMs,
        quotaRemaining: persisted?.quotaRemaining ?? runtime.quotaRemaining,
        requestsToday: persisted?.requestsToday ?? runtime.requestsToday,
        successRate: persisted?.successRate ?? runtime.successRate,
        lastError: persisted?.lastError ?? runtime.lastError,
        lastSuccessAt: persisted?.lastSuccessAt ?? runtime.lastSuccessAt,
        lastFailureAt: persisted?.lastFailureAt ?? runtime.lastFailureAt,
      };
    });
  }

  async saveProviderConfig(input: {
    organizationId: string;
    userId: string;
    providerId: ManagedProviderId;
    enabled: boolean;
    secrets: ProviderSecrets;
  }): Promise<ProviderSettingsSnapshot[]> {
    const definition = getManagedProvider(input.providerId);

    if (!definition) {
      throw new ProviderVaultServiceError("Onbekende provider.");
    }

    const trimmedSecrets: ProviderSecrets = {};

    for (const field of definition.secretFields) {
      const value = input.secrets[field.key]?.trim();

      if (field.required && !value) {
        throw new ProviderVaultServiceError(`${field.label} is verplicht.`);
      }

      if (value) {
        trimmedSecrets[field.key] = value;
      }
    }

    if (!hasRequiredSecrets(input.providerId, trimmedSecrets)) {
      throw new ProviderVaultServiceError("Vul alle verplichte velden in.");
    }

    const saved = await this.repository.upsertConfig({
      organizationId: input.organizationId,
      providerId: input.providerId,
      enabled: input.enabled,
      secrets: trimmedSecrets,
      updatedBy: input.userId,
    });

    setOrgProviderCredentials(input.organizationId, input.providerId, {
      enabled: saved.enabled,
      secrets: saved.secrets,
      fingerprint: saved.secretFingerprint,
      maskedPreview: saved.maskedPreview,
    });

    return this.getProviderSnapshots(input.organizationId);
  }

  async clearProviderSecrets(
    organizationId: string,
    providerId: ManagedProviderId,
  ): Promise<ProviderSettingsSnapshot[]> {
    await this.repository.deleteConfig(organizationId, providerId);
    removeOrgProviderCredentials(organizationId, providerId);

    return this.getProviderSnapshots(organizationId);
  }

  async persistHealthSnapshot(
    organizationId: string,
    providerId: ManagedProviderId,
  ): Promise<ProviderHealthRecord> {
    const snapshots = await this.getProviderSnapshots(organizationId);
    const snapshot = snapshots.find((entry) => entry.id === providerId);

    if (!snapshot) {
      throw new ProviderVaultServiceError("Provider niet gevonden.");
    }

    const runtime = getProviderRuntimeStats(providerId, snapshot.configured && snapshot.enabled);

    return this.repository.upsertHealth(organizationId, providerId, {
      status: snapshot.status,
      healthScore: runtime.healthScore,
      requestsToday: runtime.requestsToday,
      successRate: runtime.successRate,
      avgResponseMs: runtime.avgResponseMs,
      quotaRemaining: runtime.quotaRemaining,
      lastError: runtime.lastError,
      lastSuccessAt: runtime.lastSuccessAt,
      lastFailureAt: runtime.lastFailureAt,
    });
  }

  resetProviderCache(providerId?: ManagedProviderId): void {
    clearProviderCache(providerId);
    resetProviderStats(providerId);
  }

  invalidateOrganizationCache(organizationId: string): void {
    clearOrgCredentialCache(organizationId);
  }
}

export function createProviderVaultService(client: SupabaseClient): ProviderVaultService {
  return new ProviderVaultService(new SupabaseProviderVaultRepository(client));
}

export { getOrgProviderSecret, getOrgProviderCredentials } from "@/features/provider-vault/server/credential-cache.service";
