export type TimestampFields = {
  created_at: string;
  updated_at: string;
};

export type Company = TimestampFields & {
  id: string;
  organization_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: "active" | "inactive" | "prospect";
};

export type Contact = TimestampFields & {
  id: string;
  organization_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
};

export type Candidate = TimestampFields & {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
};

export type Vacancy = TimestampFields & {
  id: string;
  organization_id: string;
  company_id: string;
  title: string;
  location: string | null;
  employment_type: "full_time" | "part_time" | "contract" | "temporary";
  status: "draft" | "open" | "on_hold" | "closed";
};

export type PipelineStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type PipelineEntry = TimestampFields & {
  id: string;
  organization_id: string;
  vacancy_id: string;
  candidate_id: string;
  stage: PipelineStage;
  position: number;
};

export type Task = TimestampFields & {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "todo" | "in_progress" | "done";
  assignee_id: string | null;
  related_type: "company" | "contact" | "candidate" | "vacancy" | null;
  related_id: string | null;
};

export type Organization = TimestampFields & {
  id: string;
  name: string;
  slug: string;
};

export type Profile = TimestampFields & {
  id: string;
  organization_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "recruiter";
};
