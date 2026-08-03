import type { ContactFinderProviderId } from "@/features/contact-finder/domain";
import type { ContactFinderProvider } from "@/features/contact-finder/providers/contact-finder-provider";
import { openCorporatesContactProvider } from "@/features/contact-finder/providers/implementations/opencorporates.provider";

const providers: ContactFinderProvider[] = [openCorporatesContactProvider];

const providerMap = new Map(providers.map((provider) => [provider.id, provider]));

export function getContactFinderProviders(): ContactFinderProvider[] {
  return [...providers];
}

export function getContactFinderProvider(
  id: ContactFinderProviderId | string,
): ContactFinderProvider | undefined {
  return providerMap.get(id as ContactFinderProviderId);
}

export function registerContactFinderProvider(provider: ContactFinderProvider): void {
  if (providerMap.has(provider.id)) {
    return;
  }

  providers.push(provider);
  providerMap.set(provider.id, provider);
}
