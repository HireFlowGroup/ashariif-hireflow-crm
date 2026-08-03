import type { ProviderAdapter, ProviderAdapterFactory } from "@/features/lead-intelligence/providers/manager/provider-adapter.types";
import {
  hasActiveSearchProviders,
  resolveSearchProviderAvailability,
} from "@/features/lead-intelligence/providers/manager/search-provider-availability";
import type { ManagedProviderDefinition } from "@/features/lead-intelligence/providers/manager/types";
import type { ManagedProviderId } from "@/features/provider-vault/shared/domain/provider-definitions";

/** Dependency-injectable provider registry. */
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();
  private readonly factories: ProviderAdapterFactory[] = [];

  registerFactory(factory: ProviderAdapterFactory): void {
    this.factories.push(factory);
  }

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.definition.id, adapter);
  }

  initialize(): void {
    for (const factory of this.factories) {
      const adapter = factory();
      this.adapters.set(adapter.definition.id, adapter);
    }
  }

  private withLiveDefinition(adapter: ProviderAdapter): ProviderAdapter {
    if (adapter.definition.category === "search") {
      const live = resolveSearchProviderAvailability(adapter.definition.id as ManagedProviderId);
      return {
        ...adapter,
        definition: {
          ...adapter.definition,
          enabled: live.active,
          apiKeyPresent: live.configured,
          skipReason: live.skipReason,
        },
      };
    }

    if (adapter.definition.category === "discovery") {
      const searchActive = hasActiveSearchProviders(`registry.discovery.${adapter.definition.id}`);
      return {
        ...adapter,
        definition: {
          ...adapter.definition,
          enabled: searchActive,
          apiKeyPresent: searchActive,
          skipReason: searchActive ? undefined : "Vereist actieve search backend",
        },
      };
    }

    return adapter;
  }

  get(id: string): ProviderAdapter | null {
    const adapter = this.adapters.get(id);
    return adapter ? this.withLiveDefinition(adapter) : null;
  }

  getAll(): ProviderAdapter[] {
    return [...this.adapters.values()]
      .sort((a, b) => a.definition.fallbackPriority - b.definition.fallbackPriority)
      .map((adapter) => this.withLiveDefinition(adapter));
  }

  getDefinitions(): ManagedProviderDefinition[] {
    return this.getAll().map((adapter) => adapter.definition);
  }

  getByCategory(category: ManagedProviderDefinition["category"]): ProviderAdapter[] {
    return this.getAll().filter((adapter) => adapter.definition.category === category);
  }

  hasSearchCapability(): boolean {
    return hasActiveSearchProviders("registry.hasSearchCapability");
  }
}

let defaultRegistry: ProviderRegistry | null = null;

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}

export function getProviderRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    throw new Error("Provider registry niet geïnitialiseerd. Roep bootstrapProviderRegistry() aan.");
  }
  return defaultRegistry;
}

export function setProviderRegistry(registry: ProviderRegistry): void {
  defaultRegistry = registry;
}

export function bootstrapProviderRegistry(registry: ProviderRegistry): ProviderRegistry {
  registry.initialize();
  setProviderRegistry(registry);
  return registry;
}
