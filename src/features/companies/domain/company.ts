/** Branded identifier for a company record within a tenant. */
export type CompanyId = string & { readonly __brand: "CompanyId" };

export function toCompanyId(value: string): CompanyId {
  return value as CompanyId;
}

export type CompanyStatus = "active" | "inactive" | "prospect" | "archived";

export type CompanyPriority = "low" | "medium" | "high";

export type Company = {
  id: CompanyId;
  organizationId: string;
  ownerId: string | null;
  name: string;
  website: string | null;
  sector: string | null;
  city: string | null;
  employeeCount: number | null;
  priority: CompanyPriority | null;
  status: CompanyStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Input for creating a company (tenant context is applied in the service layer). */
export type CreateCompanyInput = {
  name: string;
  ownerId?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  sector?: string | null;
  city?: string | null;
  employeeCount?: number | null;
  priority?: CompanyPriority | null;
  status?: CompanyStatus;
  notes?: string | null;
};

/** Partial update payload for an existing company. */
export type UpdateCompanyInput = {
  name?: string;
  ownerId?: string | null;
  website?: string | null;
  sector?: string | null;
  city?: string | null;
  employeeCount?: number | null;
  priority?: CompanyPriority | null;
  status?: CompanyStatus;
  notes?: string | null;
};

export type SearchCompaniesInput = {
  query?: string;
  status?: CompanyStatus;
  priority?: CompanyPriority;
  city?: string;
  limit?: number;
};
