import "server-only";

export {
  runWithOrganizationId,
  runWithOrganizationIdAsync,
  getActiveOrganizationId,
  enterOrganizationContext,
} from "@/features/provider-vault/server/org-context";

export {
  getEncryptionMasterKey,
  requireEncryptionMasterKey,
  encryptSecrets,
  decryptSecrets,
  fingerprintSecrets,
  maskSecret,
  buildMaskedPreview,
  ProviderVaultEncryptionError,
} from "@/features/provider-vault/server/encryption.service";

export {
  setOrgProviderCredentials,
  removeOrgProviderCredentials,
  clearOrgCredentialCache,
  getOrgProviderCredentials,
  getOrgProviderSecret,
  isOrgProviderEnabled,
  loadOrgCredentialsIntoCache,
} from "@/features/provider-vault/server/credential-cache.service";

export {
  ProviderVaultService,
  ProviderVaultServiceError,
  createProviderVaultService,
} from "@/features/provider-vault/server/provider-vault.service";

export {
  withProviderVaultContext,
  createVaultForContext,
} from "@/features/provider-vault/server/with-provider-vault-context";

export { SupabaseProviderVaultRepository } from "@/features/provider-vault/server/repositories/supabase-provider-vault.repository";
