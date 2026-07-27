import type {
  Candidate,
  Company,
  Contact,
  Organization,
  PipelineEntry,
  Profile,
  Task,
  Vacancy,
} from "@/types/crm";
import type { AiConversation, AiMessage } from "@/types/ai";

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
