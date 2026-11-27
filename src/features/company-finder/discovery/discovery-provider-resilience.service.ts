import "server-only";

import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import {
  DISCOVERY_AI_RECRUITER_FAILOVER_PRIORITY,
  type DiscoverySearchProviderId,
} from "@/features/company-finder/discovery/discovery-provider-failover.types";
import { isDiscoverySearchProviderConfigured } from "@/features/company-finder/discovery/discovery-provider-failover.service";
import {
  getSerpApiKey,
  getTavilyApiKey,
} from "@/features/lead-intelligence/providers/manager/provider-env";

export function resolveDiscoveryMaxProviderAttempts(): number {
  const config = getAiRecruiterConfig();
  const configuredIds = DISCOVERY_AI_RECRUITER_FAILOVER_PRIORITY.filter((id) =>
    isDiscoverySearchProviderConfigured(id),
  );
  const configuredCount = configuredIds.length;
  const envCap = Math.max(1, config.discoveryMaxProviderAttemptsPerQuery);

  if (configuredCount === 0) return envCap;

  const dualConfigured = Boolean(getTavilyApiKey() && getSerpApiKey());
  const minimumForFailover = dualConfigured ? 2 : 1;

  return Math.min(Math.max(envCap, minimumForFailover), configuredCount);
}

export function resolveAiRecruiterDiscoveryProviderPriority(): readonly DiscoverySearchProviderId[] {
  return DISCOVERY_AI_RECRUITER_FAILOVER_PRIORITY;
}