import { describe, expect, it } from "vitest";

import { getCurrentTimeInputSchema } from "@/lib/ai/tools/system/get-current-time";
import { getCompanyToolParametersSchema } from "@/lib/ai/tools/companies/get-company";
import { searchRecruitmentKnowledgeToolParametersSchema } from "@/lib/ai/tools/recruitment/search-recruitment-knowledge";
import { updateCompanyToolParametersSchema } from "@/lib/ai/tools/companies/update-company";
import {
  getOpenAIToolDefinitions,
  getRegisteredTools,
} from "@/lib/ai/tools/registry";
import {
  normalizeToolArguments,
  unwrapToZodObject,
  validateOpenAIToolParameterSchema,
  zodObjectToJsonSchema,
} from "@/lib/ai/tools/schemas";

describe("OpenAI tool parameter schemas", () => {
  it("registers all built-in tools with valid strict schemas at startup", () => {
    expect(getRegisteredTools().length).toBeGreaterThan(20);

    for (const definition of getOpenAIToolDefinitions()) {
      expect(definition.type).toBe("function");
      expect(definition.strict).toBe(true);
      validateOpenAIToolParameterSchema(
        definition.name,
        definition.parameters as {
          type: "object";
          properties: Record<string, unknown>;
          required?: string[];
          additionalProperties: false;
        },
        true,
      );
    }
  });

  it("maps optional timezone to nullable strict schema for getCurrentTime", () => {
    const schema = zodObjectToJsonSchema(getCurrentTimeInputSchema, { strict: true });

    expect(schema).toEqual({
      type: "object",
      properties: {
        timezone: {
          type: ["string", "null"],
          description: "Optionele IANA-timezone, bijvoorbeeld Europe/Amsterdam.",
        },
      },
      required: ["timezone"],
      additionalProperties: false,
    });
  });

  it("keeps required-only tools aligned with properties", () => {
    const schema = zodObjectToJsonSchema(getCompanyToolParametersSchema, { strict: true });

    expect(schema.required).toEqual(["companyId"]);
    expect(Object.keys(schema.properties)).toEqual(["companyId"]);
  });

  it("marks optional fields nullable but still required under strict mode", () => {
    const schema = zodObjectToJsonSchema(
      searchRecruitmentKnowledgeToolParametersSchema,
      { strict: true },
    );

    expect(schema.required).toEqual(["query", "matchCount"]);
    expect(schema.properties.query).toEqual({ type: "string" });
    expect(schema.properties.matchCount).toEqual({ type: ["number", "null"] });
  });

  it("unwraps refined/preprocessed object schemas", () => {
    const objectSchema = unwrapToZodObject(updateCompanyToolParametersSchema);

    expect(objectSchema).not.toBeNull();

    const schema = zodObjectToJsonSchema(objectSchema!, { strict: true });
    expect(schema.required).toContain("companyId");
    expect(schema.required).toContain("name");
    expect(schema.properties.name).toEqual({ type: ["string", "null"] });
  });

  it("converts OpenAI null sentinels to undefined before Zod parsing", () => {
    expect(normalizeToolArguments({ timezone: null })).toEqual({ timezone: undefined });
    expect(normalizeToolArguments({ query: "hiring", matchCount: null })).toEqual({
      query: "hiring",
      matchCount: undefined,
    });
  });

  it("rejects invalid schemas during validation", () => {
    expect(() =>
      validateOpenAIToolParameterSchema(
        "brokenTool",
        {
          type: "object",
          properties: { timezone: { type: "string" } },
          required: [],
          additionalProperties: false,
        },
        true,
      ),
    ).toThrow(/Missing: timezone/);
  });
});
