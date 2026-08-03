/**
 * Diagnose Recruitment Lead Intelligence provider state.
 * Run: node scripts/diagnose-company-finder-providers.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

const discoveryProviders = [
  {
    name: "Google Search (Brave)",
    id: "brave-web-search",
    order: 1,
    enabled: hasEnv("WEB_SEARCH_API_KEY") || hasEnv("BRAVE_SEARCH_API_KEY"),
    reason: "WEB_SEARCH_API_KEY niet geconfigureerd",
  },
  {
    name: "Google Maps (Brave)",
    id: "brave-google-maps",
    order: 2,
    enabled: hasEnv("WEB_SEARCH_API_KEY") || hasEnv("BRAVE_SEARCH_API_KEY"),
    reason: "WEB_SEARCH_API_KEY niet geconfigureerd",
  },
  {
    name: "Indeed",
    id: "brave-indeed",
    order: 6,
    enabled: hasEnv("WEB_SEARCH_API_KEY") || hasEnv("BRAVE_SEARCH_API_KEY"),
    reason: "WEB_SEARCH_API_KEY niet geconfigureerd",
  },
  {
    name: "Nationale Vacaturebank",
    id: "brave-nationale-vacaturebank",
    order: 7,
    enabled: hasEnv("WEB_SEARCH_API_KEY") || hasEnv("BRAVE_SEARCH_API_KEY"),
    reason: "WEB_SEARCH_API_KEY niet geconfigureerd",
  },
  {
    name: "Werken-bij sites",
    id: "brave-werkenbij",
    order: 8,
    enabled: hasEnv("WEB_SEARCH_API_KEY") || hasEnv("BRAVE_SEARCH_API_KEY"),
    reason: "WEB_SEARCH_API_KEY niet geconfigureerd",
  },
];

const enrichment = [
  {
    name: "Firecrawl (website crawl)",
    enabled: hasEnv("FIRECRAWL_API_KEY"),
    reason: "FIRECRAWL_API_KEY niet geconfigureerd — fallback naar native fetch",
  },
  {
    name: "OpenAI (classificatie & samenvatting)",
    enabled: hasEnv("OPENAI_API_KEY"),
    reason: "OPENAI_API_KEY niet geconfigureerd — fallback scoring",
  },
];

console.log("=== Recruitment Lead Intelligence Diagnose ===\n");

console.log("Discovery providers (volgorde):");
for (const provider of discoveryProviders) {
  console.log(
    `  ${provider.order}. ${provider.name}: ${provider.enabled ? "ACTIEF" : `uit (${provider.reason})`}`,
  );
}

console.log("\nEnrichment:");
for (const item of enrichment) {
  console.log(`  - ${item.name}: ${item.enabled ? "ACTIEF" : `uit (${item.reason})`}`);
}

const activeDiscovery = discoveryProviders.filter((provider) => provider.enabled);

if (activeDiscovery.length === 0) {
  console.log("\nBOTTLENECK: geen discovery providers — stel WEB_SEARCH_API_KEY in.");
} else {
  console.log(`\n${activeDiscovery.length} discovery provider(s) actief.`);
}

console.log("\nPipeline: Plaats+Branche → Brave Search → Website (Firecrawl) → LinkedIn → Vacatures → AI score → Supabase");
