import { ensureProviderRegistryBootstrapped } from "@/features/lead-intelligence/providers/manager/provider-registry";
import { ProviderManager } from "@/features/lead-intelligence/providers/manager/provider-manager";

let managerInstance: ProviderManager | null = null;

export function createProviderManager(): ProviderManager {
  const registry = ensureProviderRegistryBootstrapped();
  return new ProviderManager(registry);
}

export function getProviderManager(): ProviderManager {
  if (!managerInstance) {
    managerInstance = createProviderManager();
  }
  return managerInstance;
}

/** Test/DI hook — vervang manager met custom registry. */
export function setProviderManager(manager: ProviderManager): void {
  managerInstance = manager;
}

export function resetProviderManager(): void {
  managerInstance = null;
}
