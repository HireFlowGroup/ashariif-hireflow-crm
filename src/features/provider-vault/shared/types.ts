/** Marker interface for dependency injection — client code must not import implementations. */
export type ProviderVaultRepository = {
  listConfigs(organizationId: string): Promise<unknown[]>;
};
