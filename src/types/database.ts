import type {
  AiSummary,
  CompanyIntelligence,
  CompanyScore,
  HiringSignal,
  IntelligenceNotification,
  IntelligenceQueueJob,
  IntelligenceScanRun,
  Outreach,
  RecruitmentKnowledgeChunkRow,
  OutreachGenerationRow,
  OutreachIntelligenceRow,
} from "@/types/hiring-intelligence";
import type {
  Candidate,
  Company,
  Contact,
  Organization,
  PipelineEntry,
  Profile,
  Task,
  Vacancy,
  CommercialPipelineCardRow,
} from "@/types/crm";
import type { AiConversation, AiMessage } from "@/types/ai";
import type { AiToolLog, OrganizationProviderConfig, OrganizationProviderHealth, PlatformEvent } from "@/types/platform";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Organization>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      companies: {
        Row: Company;
        Insert: Omit<Company, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Company>;
        Relationships: [];
      };
      hiring_signals: {
        Row: HiringSignal;
        Insert: Omit<HiringSignal, "id" | "created_at" | "updated_at" | "processed_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<HiringSignal>;
        Relationships: [];
      };
      company_scores: {
        Row: CompanyScore;
        Insert: Omit<CompanyScore, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<CompanyScore>;
        Relationships: [];
      };
      ai_summaries: {
        Row: AiSummary;
        Insert: Omit<AiSummary, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AiSummary>;
        Relationships: [];
      };
      outreach: {
        Row: Outreach;
        Insert: Omit<Outreach, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Outreach>;
        Relationships: [];
      };
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Contact>;
        Relationships: [];
      };
      candidates: {
        Row: Candidate;
        Insert: Omit<Candidate, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Candidate>;
        Relationships: [];
      };
      vacancies: {
        Row: Vacancy;
        Insert: Omit<Vacancy, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Vacancy>;
        Relationships: [];
      };
      pipeline_entries: {
        Row: PipelineEntry;
        Insert: Omit<PipelineEntry, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<PipelineEntry>;
        Relationships: [];
      };
      commercial_pipeline_cards: {
        Row: CommercialPipelineCardRow;
        Insert: Omit<
          CommercialPipelineCardRow,
          "id" | "created_at" | "updated_at" | "moved_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          moved_at?: string;
        };
        Update: Partial<CommercialPipelineCardRow>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Task>;
        Relationships: [];
      };
      ai_conversations: {
        Row: AiConversation;
        Insert: Omit<AiConversation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AiConversation>;
        Relationships: [];
      };
      ai_messages: {
        Row: AiMessage;
        Insert: Omit<AiMessage, "id" | "created_at" | "tool_name"> & {
          id?: string;
          created_at?: string;
          tool_name?: string | null;
        };
        Update: Partial<AiMessage>;
        Relationships: [];
      };
      intelligence_scan_runs: {
        Row: IntelligenceScanRun;
        Insert: Omit<
          IntelligenceScanRun,
          "id" | "created_at" | "updated_at" | "companies_processed" | "signals_created" | "signals_updated" | "notifications_created" | "errors_count"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          companies_processed?: number;
          signals_created?: number;
          signals_updated?: number;
          notifications_created?: number;
          errors_count?: number;
        };
        Update: Partial<IntelligenceScanRun>;
        Relationships: [];
      };
      intelligence_scan_queue: {
        Row: IntelligenceQueueJob;
        Insert: Omit<
          IntelligenceQueueJob,
          "id" | "created_at" | "updated_at" | "attempts" | "result"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          attempts?: number;
          result?: Json;
        };
        Update: Partial<IntelligenceQueueJob>;
        Relationships: [];
      };
      intelligence_notifications: {
        Row: IntelligenceNotification;
        Insert: Omit<IntelligenceNotification, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<IntelligenceNotification>;
        Relationships: [];
      };
      recruitment_knowledge_chunks: {
        Row: RecruitmentKnowledgeChunkRow;
        Insert: Omit<RecruitmentKnowledgeChunkRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RecruitmentKnowledgeChunkRow>;
        Relationships: [];
      };
      outreach_intelligence: {
        Row: OutreachIntelligenceRow;
        Insert: Omit<OutreachIntelligenceRow, "id" | "created_at" | "updated_at" | "computed_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          computed_at?: string;
        };
        Update: Partial<OutreachIntelligenceRow>;
        Relationships: [];
      };
      outreach_generations: {
        Row: OutreachGenerationRow;
        Insert: Omit<OutreachGenerationRow, "id" | "created_at" | "generated_at"> & {
          id?: string;
          created_at?: string;
          generated_at?: string;
        };
        Update: Partial<OutreachGenerationRow>;
        Relationships: [];
      };
      ai_tool_logs: {
        Row: AiToolLog;
        Insert: Omit<AiToolLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AiToolLog>;
        Relationships: [];
      };
      platform_events: {
        Row: PlatformEvent;
        Insert: Omit<PlatformEvent, "created_at" | "processed_at"> & {
          created_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<PlatformEvent>;
        Relationships: [];
      };
      organization_provider_configs: {
        Row: OrganizationProviderConfig;
        Insert: Omit<OrganizationProviderConfig, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<OrganizationProviderConfig>;
        Relationships: [];
      };
      organization_provider_health: {
        Row: OrganizationProviderHealth;
        Insert: Omit<OrganizationProviderHealth, "id" | "updated_at"> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<OrganizationProviderHealth>;
        Relationships: [];
      };
    };
    Views: {
      companies_intelligence: {
        Row: CompanyIntelligence;
        Relationships: [];
      };
      outreach_queue_compat: {
        Row: Pick<
          Outreach,
          | "id"
          | "organization_id"
          | "company_id"
          | "user_id"
          | "status"
          | "suggested_contact_role"
          | "outreach_angle"
          | "review_required"
          | "created_at"
          | "updated_at"
        >;
        Relationships: [];
      };
    };
    Functions: {
      apply_hiring_signal_to_company: {
        Args: { p_signal_id: string };
        Returns: undefined;
      };
      upsert_hiring_signal: {
        Args: {
          p_organization_id: string;
          p_company_id: string | null;
          p_job_id: string | null;
          p_provider: string;
          p_signal_type: string;
          p_fingerprint: string;
          p_title: string;
          p_description: string;
          p_source_url: string | null;
          p_source: string;
          p_confidence: number;
          p_importance: number;
          p_ai_relevance: number;
          p_external_id: string | null;
          p_payload: Json;
          p_extracted_fields: Json;
          p_observed_at: string;
        };
        Returns: HiringSignal;
      };
      claim_intelligence_scan_jobs: {
        Args: { p_worker_id: string; p_batch_size?: number };
        Returns: IntelligenceQueueJob[];
      };
      release_stale_intelligence_scan_jobs: {
        Args: { p_stale_minutes?: number };
        Returns: number;
      };
      match_recruitment_knowledge: {
        Args: {
          p_organization_id: string;
          p_query_embedding: string;
          p_match_count?: number;
          p_entity_type?: string | null;
        };
        Returns: Array<{
          id: string;
          entity_type: string;
          entity_id: string;
          title: string | null;
          content: string;
          metadata: Json;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type { HiringSignal, CompanyScore, AiSummary, Outreach, CompanyIntelligence };
export type {
  IntelligenceScanRun,
  IntelligenceQueueJob,
  IntelligenceNotification,
} from "@/types/hiring-intelligence";
