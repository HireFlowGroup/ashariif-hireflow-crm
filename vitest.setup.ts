import { vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Unit tests must not inherit commercial-E2E caps from `.env.local` (Vite loads it in dev).
 * Integration tests use vitest.integration.config with explicit overrides.
 */
const UNIT_TEST_AI_RECRUITER_ENV: Record<string, string> = {
  AI_RECRUITER_DEFAULT_MAX_COMPANIES: "25",
  AI_RECRUITER_DEFAULT_MAX_DRAFTS: "10",
  AI_RECRUITER_PLAN_LIMIT_MAXIMUM_COMPANIES: "25",
  AI_RECRUITER_PLAN_LIMIT_MAXIMUM_DRAFTS: "10",
  AI_RECRUITER_DISCOVERY_QUERY_COUNT: "12",
  AI_RECRUITER_MIN_DISCOVERY_QUERIES: "5",
  AI_RECRUITER_CONCEPT_SCORE_THRESHOLD: "30",
  AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN: "12",
  AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY: "3",
  AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI: "6",
  AI_RECRUITER_DISCOVERY_CONCURRENCY: "4",
  AI_RECRUITER_RESULTS_PER_QUERY: "10",
};

for (const [key, value] of Object.entries(UNIT_TEST_AI_RECRUITER_ENV)) {
  process.env[key] = value;
}

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_ORGANIZATION;
