import {
  IntelligentSearchParserError,
  parseRecruitmentSearchQuery,
} from "@/features/intelligent-search/server";
import { parseSearchQueryInputSchema } from "@/features/intelligent-search/validation/parse-query.schemas";
import { withProviderVaultContext } from "@/features/provider-vault/server";
import { DomainError } from "@/platform/errors/domain-error";
import { createApiHandler } from "@/platform/http/api-handler";

export const POST = createApiHandler(
  "company-finder.parse-query",
  async (request, ctx) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new DomainError("VALIDATION_ERROR", "Ongeldige JSON in het verzoek.");
    }

    const parsed = parseSearchQueryInputSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Ongeldige zoekopdracht.";
      throw new DomainError("VALIDATION_ERROR", message);
    }

    try {
      const result = await withProviderVaultContext(ctx.auth, () =>
        parseRecruitmentSearchQuery(parsed.data.query, { requestId: ctx.requestId }),
      );

      return {
        success: true,
        query: parsed.data.query,
        filters: result.filters,
        criteria: result.criteria,
      };
    } catch (error) {
      if (error instanceof IntelligentSearchParserError) {
        if (error.code === "OPENAI_NOT_CONFIGURED") {
          throw new DomainError("SERVICE_UNAVAILABLE", error.message);
        }

        if (error.code === "INVALID_OUTPUT") {
          throw new DomainError("INTERNAL_ERROR", error.message);
        }

        throw new DomainError("VALIDATION_ERROR", error.message);
      }

      throw error;
    }
  },
  { rateLimit: 20 },
);
