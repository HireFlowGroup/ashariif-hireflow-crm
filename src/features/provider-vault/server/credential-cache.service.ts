import "server-only";

import type {
  ManagedProviderId,
  ProviderSecrets,
} from "@/features/provider-vault/shared/domain/provider-definitions";

type OrgCredentialEntry = {
  enabled: boolean;
  secrets: ProviderSecrets;
  fingerprint: string;
  maskedPreview: string | null;
};

const orgCache = new Map<string, Map<ManagedProviderId, OrgCredentialEntry>>();

export function setOrgProviderCredentials(
  organizationId: string,
  providerId: ManagedProviderId,
  entry: OrgCredentialEntry,
): void {
  let orgMap = orgCache.get(organizationId);

  if (!orgMap) {
    orgMap = new Map();
    orgCache.set(organizationId, orgMap);
  }

  orgMap.set(providerId, entry);
}

export function removeOrgProviderCredentials(
  organizationId: string,
  providerId: ManagedProviderId,
): void {
  orgCache.get(organizationId)?.delete(providerId);
}

export function clearOrgCredentialCache(organizationId?: string): void {
  if (organizationId) {
    orgCache.delete(organizationId);
    return;
  }

  orgCache.clear();
}

export function getOrgProviderCredentials(
  organizationId: string,
  providerId: ManagedProviderId,
): OrgCredentialEntry | null {
  return orgCache.get(organizationId)?.get(providerId) ?? null;
}

export function getOrgProviderSecret(
  organizationId: string | undefined,
  providerId: ManagedProviderId,
  field: string,
): string | null {
  if (!organizationId) return null;

  const entry = getOrgProviderCredentials(organizationId, providerId);

  if (!entry?.enabled) return null;

  const value = entry.secrets[field]?.trim();
  return value || null;
}

export function isOrgProviderEnabled(
  organizationId: string,
  providerId: ManagedProviderId,
): boolean {
  const entry = getOrgProviderCredentials(organizationId, providerId);
  return entry?.enabled ?? true;
}

export function loadOrgCredentialsIntoCache(
  organizationId: string,
  configs: Array<{
    providerId: ManagedProviderId;
    enabled: boolean;
    secrets: ProviderSecrets;
    fingerprint: string;
    maskedPreview: string | null;
  }>,
): void {
  clearOrgCredentialCache(organizationId);

  for (const config of configs) {
    setOrgProviderCredentials(organizationId, config.providerId, {
      enabled: config.enabled,
      secrets: config.secrets,
      fingerprint: config.fingerprint,
      maskedPreview: config.maskedPreview,
    });
  }
}
