import {
  getSearchSignalProviders,
} from "@/features/hiring-intelligence/providers/implementations/search-signal.providers";
import { firecrawlSignalProvider } from "@/features/hiring-intelligence/providers/implementations/firecrawl-signal.provider";
import type { HiringSignalProvider } from "@/features/hiring-intelligence/providers/types";

const customSignalProviders: HiringSignalProvider[] = [];

function getAllRegisteredSignalProviders(): HiringSignalProvider[] {
  return [...getSearchSignalProviders(), firecrawlSignalProvider, ...customSignalProviders];
}

export function getSignalProviders(): HiringSignalProvider[] {
  return getAllRegisteredSignalProviders()
    .filter((provider) => provider.enabled)
    .sort((a, b) => a.order - b.order);
}

export function getAllSignalProviders(): HiringSignalProvider[] {
  return getAllRegisteredSignalProviders().sort((a, b) => a.order - b.order);
}

export function getSkippedSignalProviders(): Array<{ name: string; reason: string }> {
  return getAllRegisteredSignalProviders()
    .filter((provider) => !provider.enabled)
    .map((provider) => ({
      name: provider.displayName,
      reason: provider.skipReason ?? "Uitgeschakeld",
    }));
}

export function registerSignalProvider(provider: HiringSignalProvider): void {
  const index = customSignalProviders.findIndex((entry) => entry.id === provider.id);

  if (index >= 0) {
    customSignalProviders[index] = provider;
    return;
  }

  customSignalProviders.push(provider);
}
