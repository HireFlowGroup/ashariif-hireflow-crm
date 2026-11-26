import type { Company } from "@/features/companies/domain";
import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import type {
  EvidenceConfidence,
  ProspectEvidenceBundle,
  ProspectSelectionEvidenceRecord,
  SelectionCriterionKey,
} from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";
import { PROSPECT_EVIDENCE_MODEL_VERSION } from "@/features/ai-recruiter/domain/prospect-selection-evidence.types";
import {
  evaluateEmployeeRangeConstraint,
  evaluateLocationConstraint,
  evaluateSectorConstraint,
} from "@/features/ai-recruiter/services/company-constraint-validation.service";
import { parseEmployeeRangeFromLabel } from "@/features/ai-recruiter/services/employee-range-enrichment.service";

function nowIso(): string {
  return new Date().toISOString();
}

function record(input: Omit<ProspectSelectionEvidenceRecord, "verifiedAt">): ProspectSelectionEvidenceRecord {
  return { ...input, verifiedAt: nowIso() };
}

export function employeeLabelIsVerified(label: string | null | undefined): boolean {
  if (!label?.trim()) return false;
  if (/Geschat \(AI/i.test(label)) return false;
  return /(bewijs in bron|linkedin|kvk|offici[eë]le|fte:\s*\d|employees:\s*\d|\d+\s*(?:tot|-)\s*\d+)/i.test(label);
}

export function collectCompanyRecordEvidence(company: Company): ProspectSelectionEvidenceRecord[] {
  const records: ProspectSelectionEvidenceRecord[] = [];
  const sourceUrl = company.website ?? company.sourceUrl ?? null;

  if (company.employeeCountMin !== null || company.employeeCountMax !== null) {
    const label = company.employeeCountLabel ?? `${company.employeeCountMin ?? "?"}-${company.employeeCountMax ?? "?"}`;
    const conflicting =
      company.employeeCountMin !== null
      && company.employeeCountMax !== null
      && company.employeeCountMin > company.employeeCountMax
        ? "min > max in bedrijfsrecord"
        : null;

    records.push(
      record({
        criterion: "employee_range",
        sourceUrl,
        sourceType: "company_record",
        finding: `Medewerkersrange ${label}`,
        confidence: conflicting ? "conflicting" : employeeLabelIsVerified(label) ? "verified" : "inferred",
        conflictingFinding: conflicting,
      }),
    );
  } else if (company.employeeCountLabel) {
    const parsed = parseEmployeeRangeFromLabel(company.employeeCountLabel);
    records.push(
      record({
        criterion: "employee_range",
        sourceUrl,
        sourceType: "company_record",
        finding: company.employeeCountLabel,
        confidence: employeeLabelIsVerified(company.employeeCountLabel)
          ? "verified"
          : parsed
            ? "inferred"
            : "unknown",
        conflictingFinding: null,
      }),
    );
  }

  if (company.sector?.trim()) {
    records.push(
      record({
        criterion: "sector",
        sourceUrl,
        sourceType: "company_record",
        finding: `Sector: ${company.sector}`,
        confidence: "verified",
        conflictingFinding: null,
      }),
    );
  }

  if (company.city?.trim() || company.region?.trim()) {
    records.push(
      record({
        criterion: "location",
        sourceUrl,
        sourceType: "company_record",
        finding: `Locatie: ${[company.city, company.region].filter(Boolean).join(", ")}`,
        confidence: company.city ? "verified" : "inferred",
        conflictingFinding: null,
      }),
    );
  }

  return records;
}

export function detectConflictingEvidence(
  records: ProspectSelectionEvidenceRecord[],
): SelectionCriterionKey[] {
  const conflicting: SelectionCriterionKey[] = [];
  for (const item of records) {
    if (item.confidence === "conflicting" || item.conflictingFinding) {
      conflicting.push(item.criterion);
    }
  }
  return [...new Set(conflicting)];
}

export function assessMissingSelectionCriteria(
  company: Company,
  plan: AiRecruiterSearchPlan,
): SelectionCriterionKey[] {
  const missing: SelectionCriterionKey[] = [];

  const employeeRequired = plan.employee_range.min !== null || plan.employee_range.max !== null;
  if (employeeRequired && evaluateEmployeeRangeConstraint(company, plan) === "unknown") {
    missing.push("employee_range");
  }

  if (plan.sectors.length > 0 && evaluateSectorConstraint(company, plan) === "unknown") {
    missing.push("sector");
  }

  if (
    (plan.locations.length > 0 || plan.regions.length > 0)
    && evaluateLocationConstraint(company, plan) === "unknown"
  ) {
    missing.push("location");
  }

  return missing;
}

export function buildProspectEvidenceBundle(input: {
  company: Company;
  plan: AiRecruiterSearchPlan;
  extraRecords?: ProspectSelectionEvidenceRecord[];
}): ProspectEvidenceBundle {
  const records = [...collectCompanyRecordEvidence(input.company), ...(input.extraRecords ?? [])];
  return {
    version: PROSPECT_EVIDENCE_MODEL_VERSION,
    records,
    missingCriteria: assessMissingSelectionCriteria(input.company, input.plan),
    conflictingCriteria: detectConflictingEvidence(records),
  };
}

export function appendEvidenceRecords(
  bundle: ProspectEvidenceBundle,
  added: ProspectSelectionEvidenceRecord[],
): ProspectSelectionEvidenceRecord[] {
  return [...bundle.records, ...added];
}