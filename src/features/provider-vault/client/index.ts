/** Client-safe provider vault types (no server dependencies). */
export type {
  ManagedProviderId,
  ProviderSecretField,
  ProviderSettingsSnapshot,
} from "@/features/provider-vault/shared/domain/provider-definitions";

export {
  MANAGED_PROVIDER_IDS,
  isManagedProviderId,
} from "@/features/provider-vault/shared/domain/provider-definitions";
