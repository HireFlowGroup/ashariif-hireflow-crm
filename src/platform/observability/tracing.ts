import { platformLogger } from "@/platform/observability/logger";
import { getServerEnv } from "@/platform/config/env";

export type SpanAttributes = Record<string, string | number | boolean>;

export type Span = {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: unknown): void;
  end(): void;
};

/** OpenTelemetry-compatible tracing interface. Wire full OTel SDK in production. */
export type Tracer = {
  startSpan(name: string, attributes?: SpanAttributes): Span;
  withSpan<T>(name: string, fn: () => Promise<T>, attributes?: SpanAttributes): Promise<T>;
};

class ConsoleSpan implements Span {
  private readonly started = Date.now();
  private readonly attributes: SpanAttributes = {};

  constructor(
    private readonly name: string,
    attributes?: SpanAttributes,
  ) {
    if (attributes) Object.assign(this.attributes, attributes);
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  recordException(error: unknown): void {
    this.attributes.error = error instanceof Error ? error.message : String(error);
  }

  end(): void {
    if (!getServerEnv().OTEL_ENABLED) return;

    platformLogger.debug("span.end", {
      span: this.name,
      durationMs: Date.now() - this.started,
      ...this.attributes,
    });
  }
}

export const tracer: Tracer = {
  startSpan(name, attributes) {
    return new ConsoleSpan(name, attributes);
  },

  async withSpan(name, fn, attributes) {
    const span = new ConsoleSpan(name, attributes);
    try {
      const result = await fn();
      return result;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  },
};
