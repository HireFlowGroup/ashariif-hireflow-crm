export {
  MANAGED_PROVIDER_IDS,
  MANAGED_PROVIDERS,
  getManagedProvider,
  isManagedProviderId,
  type ManagedProviderId,
  type ManagedProviderDefinition,
  type ProviderSecretField,
  type ProviderSecrets,
  type ProviderConfigRecord,
  type ProviderHealthRecord,
  type ProviderSettingsSnapshot,
} from "@/features/provider-vault/shared/domain/provider-definitions";

export { saveProviderConfigSchema, providerIdParamSchema } from "@/features/provider-vault/shared/validation/provider-vault.schemas";

export type { ProviderVaultRepository } from "@/features/provider-vault/shared/types";
