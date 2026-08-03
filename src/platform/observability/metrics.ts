type Counter = {
  inc(labels?: Record<string, string>, value?: number): void;
};

type Histogram = {
  observe(value: number, labels?: Record<string, string>): void;
};

const counters = new Map<string, number>();
const histograms = new Map<string, number[]>();

/** Lightweight in-process metrics — export to Prometheus/Datadog via sidecar in production. */
export const metrics = {
  counter(name: string): Counter {
    return {
      inc(labels = {}, value = 1) {
        const key = `${name}:${JSON.stringify(labels)}`;
        counters.set(key, (counters.get(key) ?? 0) + value);
      },
    };
  },

  histogram(name: string): Histogram {
    return {
      observe(value, labels = {}) {
        const key = `${name}:${JSON.stringify(labels)}`;
        const bucket = histograms.get(key) ?? [];
        bucket.push(value);
        if (bucket.length > 1000) bucket.shift();
        histograms.set(key, bucket);
      },
    };
  },

  snapshot(): { counters: Record<string, number>; histograms: Record<string, { count: number; avg: number }> } {
    const histogramSnapshot: Record<string, { count: number; avg: number }> = {};

    for (const [key, values] of histograms.entries()) {
      const avg = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
      histogramSnapshot[key] = { count: values.length, avg: Math.round(avg * 100) / 100 };
    }

    return {
      counters: Object.fromEntries(counters.entries()),
      histograms: histogramSnapshot,
    };
  },

  resetForTests(): void {
    counters.clear();
    histograms.clear();
  },
};

export const apiRequestCounter = metrics.counter("api_requests_total");
export const apiDurationHistogram = metrics.histogram("api_request_duration_ms");
export const toolExecutionCounter = metrics.counter("ai_tool_executions_total");
