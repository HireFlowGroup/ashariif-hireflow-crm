import { z } from "zod";

export type OpenAIToolParameterSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

type JsonSchemaConversionOptions = {
  /** OpenAI strict function tools require every property in `required`. */
  strict: boolean;
};

/** Converts a Zod object schema into OpenAI function parameters (strict-mode compatible). */
export function zodObjectToJsonSchema(
  schema: z.ZodObject<z.ZodRawShape>,
  options: JsonSchemaConversionOptions = { strict: true },
): OpenAIToolParameterSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    const optional = isOptionalField(fieldSchema);
    properties[key] = zodFieldToJsonProperty(fieldSchema, optional);

    if (options.strict || !optional) {
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

/** Unwraps ZodEffects (.refine, .preprocess) to the underlying object schema. */
export function unwrapToZodObject(schema: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  if (schema instanceof z.ZodObject) {
    return schema;
  }

  if (schema instanceof z.ZodEffects) {
    return unwrapToZodObject(schema._def.schema as z.ZodTypeAny);
  }

  return null;
}

/** Validates OpenAI function parameter schemas before tools are registered. */
export function validateOpenAIToolParameterSchema(
  toolName: string,
  schema: OpenAIToolParameterSchema,
  strict: boolean,
): void {
  if (schema.type !== "object") {
    throw new Error(`Tool "${toolName}": parameters.type must be "object".`);
  }

  if (schema.additionalProperties !== false) {
    throw new Error(`Tool "${toolName}": parameters.additionalProperties must be false.`);
  }

  const propertyKeys = Object.keys(schema.properties);
  const required = schema.required ?? [];

  for (const key of required) {
    if (!(key in schema.properties)) {
      throw new Error(
        `Tool "${toolName}": required field "${key}" is missing from properties.`,
      );
    }
  }

  for (const key of required) {
    if (!propertyKeys.includes(key)) {
      throw new Error(
        `Tool "${toolName}": required field "${key}" is not declared in properties.`,
      );
    }
  }

  const unexpectedRequired = required.filter((key) => !propertyKeys.includes(key));
  if (unexpectedRequired.length > 0) {
    throw new Error(
      `Tool "${toolName}": required contains undeclared properties: ${unexpectedRequired.join(", ")}.`,
    );
  }

  if (strict) {
    const missingFromRequired = propertyKeys.filter((key) => !required.includes(key));
    if (missingFromRequired.length > 0) {
      throw new Error(
        `Tool "${toolName}": strict mode requires all properties in required. Missing: ${missingFromRequired.join(", ")}.`,
      );
    }
  } else {
    const extraRequired = required.filter((key) => {
      const property = schema.properties[key] as { type?: string | string[] } | undefined;
      const types = normalizeTypes(property?.type);
      return types.includes("null");
    });

    if (extraRequired.length > 0) {
      throw new Error(
        `Tool "${toolName}": nullable optional fields must not appear in required when strict=false: ${extraRequired.join(", ")}.`,
      );
    }
  }
}

function zodFieldToJsonProperty(fieldSchema: z.ZodTypeAny, optional: boolean): Record<string, unknown> {
  const base = unwrapOptional(fieldSchema);
  const description = readDescription(fieldSchema) ?? readDescription(base);

  if (base instanceof z.ZodString) {
    return buildProperty("string", optional, { description });
  }

  if (base instanceof z.ZodNumber) {
    return buildProperty("number", optional, { description });
  }

  if (base instanceof z.ZodBoolean) {
    return buildProperty("boolean", optional, { description });
  }

  if (base instanceof z.ZodEnum) {
    const values = base._def.values as [string, ...string[]];
    return buildProperty("string", optional, {
      description,
      enum: optional ? [...values, null] : values,
    });
  }

  if (base instanceof z.ZodNativeEnum) {
    const values = Object.values(base._def.values).filter(
      (value): value is string => typeof value === "string",
    ) as [string, ...string[]];

    return buildProperty("string", optional, {
      description,
      enum: optional ? [...values, null] : values,
    });
  }

  return buildProperty("string", optional, { description });
}

function buildProperty(
  baseType: "string" | "number" | "boolean",
  optional: boolean,
  extras: { description?: string; enum?: unknown[] },
): Record<string, unknown> {
  return {
    type: optional ? [baseType, "null"] : baseType,
    ...(extras.description ? { description: extras.description } : {}),
    ...(extras.enum ? { enum: extras.enum } : {}),
  };
}

function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return unwrapOptional(schema._def.innerType as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodEffects) {
    return unwrapOptional(schema._def.schema as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodNullable) {
    return unwrapOptional(schema._def.innerType as z.ZodTypeAny);
  }

  return schema;
}

function isOptionalField(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return true;
  }

  if (schema instanceof z.ZodEffects) {
    return isOptionalField(schema._def.schema as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodNullable) {
    return true;
  }

  return false;
}

function readDescription(schema: z.ZodTypeAny): string | undefined {
  if (typeof schema.description === "string" && schema.description.length > 0) {
    return schema.description;
  }

  return undefined;
}

function normalizeTypes(type: string | string[] | undefined): string[] {
  if (!type) return [];
  return Array.isArray(type) ? type : [type];
}

/** OpenAI strict mode sends null for omitted optional fields — Zod expects undefined. */
export function normalizeToolArguments(value: unknown): unknown {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      entry === null ? undefined : entry,
    ]),
  );
}

/** Parses untrusted JSON tool arguments. */
export function parseToolArguments(rawArguments: string): unknown {
  if (!rawArguments.trim()) {
    return {};
  }

  return normalizeToolArguments(JSON.parse(rawArguments) as unknown);
}
