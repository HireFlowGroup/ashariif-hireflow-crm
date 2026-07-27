import { z } from "zod";

type JsonSchemaObject = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

/** Converts a Zod object schema into OpenAI function parameters (limited but typed). */
export function zodObjectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): JsonSchemaObject {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    const unwrapped = unwrapOptional(fieldSchema);

    if (unwrapped instanceof z.ZodString) {
      properties[key] = {
        type: "string",
        description: unwrapped.description,
      };
    } else if (unwrapped instanceof z.ZodNumber) {
      properties[key] = {
        type: "number",
        description: unwrapped.description,
      };
    } else if (unwrapped instanceof z.ZodBoolean) {
      properties[key] = {
        type: "boolean",
        description: unwrapped.description,
      };
    } else {
      properties[key] = { type: "string" };
    }

    if (!isOptional(fieldSchema)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return unwrapOptional(schema._def.innerType as z.ZodTypeAny);
  }

  return schema;
}

function isOptional(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodDefault;
}

/** Parses untrusted JSON tool arguments. */
export function parseToolArguments(rawArguments: string): unknown {
  if (!rawArguments.trim()) {
    return {};
  }

  return JSON.parse(rawArguments) as unknown;
}
