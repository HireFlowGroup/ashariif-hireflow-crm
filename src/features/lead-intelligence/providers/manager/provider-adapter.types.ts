import type {
  CrawlResult,
  ManagedProviderDefinition,
  ProviderTestResult,
  SearchResultItem,
} from "@/features/lead-intelligence/providers/manager/types";

export type ProviderExecutionResult<T> = {
  data: T;
  responseSize: number;
  quotaRemaining?: number | null;
};

/** Pluggable provider adapter — geen hardcoded providers in de manager. */
export interface ProviderAdapter {
  readonly definition: ManagedProviderDefinition;

  test(): Promise<ProviderTestResult>;

  executeSearch?(
    query: string,
    maxResults: number,
  ): Promise<ProviderExecutionResult<SearchResultItem[]>>;

  executeCrawl?(url: string): Promise<ProviderExecutionResult<CrawlResult>>;
}

export type ProviderAdapterFactory = () => ProviderAdapter;
