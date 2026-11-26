/**
 * EXPLICIT_TEST_FIXTURE — reconstructed from Run F / Run G logs and UI (read-only RCA).
 * Not live API data; used for regression and documentation tests only.
 */

export type P0RunCompanyRcaRow = {
  run: "F" | "G";
  name: string;
  domain: string | null;
  searchQueryHint: string;
  sources: string[];
  location: string | null;
  sector: string | null;
  employeeEvidence: "verified" | "unknown" | "outside_range" | "not_evaluated";
  employeeNotes: string;
  vacancies: string[];
  vacancyRoleMatch: "exact" | "semantic" | "none" | "department_noise" | "not_checked";
  hiringScore: number | null;
  opportunityScore: number | null;
  rejectionReason: string;
  failureClass: "unsuitable" | "insufficient_data" | "technical" | "misclassification";
  notes: string;
};

const RUN_F_QUERY =
  "softwarebedrijven Rotterdam Den Haag 20-200 medewerkers recruiters accountmanagers customer success";

export const P0_RUN_FG_COMPANY_RCA: P0RunCompanyRcaRow[] = [
  {
    run: "F",
    name: "Lindenhaeghe",
    domain: "lindenhaeghe.nl",
    searchQueryHint: RUN_F_QUERY,
    sources: ["serpapi"],
    location: "Zuid-Holland",
    sector: "software",
    employeeEvidence: "unknown",
    employeeNotes: "Geen betrouwbare FTE in run — enrichment niet afgerond voor eligibility",
    vacancies: [],
    vacancyRoleMatch: "not_checked",
    hiringScore: null,
    opportunityScore: null,
    rejectionReason: "employee_range_unknown / scores onder plan (70)",
    failureClass: "insufficient_data",
    notes: "Opgeslagen vóór cap-fix; geen concept.",
  },
  {
    run: "F",
    name: "Pontifexx",
    domain: "pontifexx.com",
    searchQueryHint: RUN_F_QUERY,
    sources: ["serpapi"],
    location: null,
    sector: "software",
    employeeEvidence: "unknown",
    employeeNotes: "Onbekend medewerkersaantal",
    vacancies: [],
    vacancyRoleMatch: "none",
    hiringScore: null,
    opportunityScore: null,
    rejectionReason: "employee_range_unknown / vacaturebewijs",
    failureClass: "insufficient_data",
    notes: "Run G: dedupe-update fout bij herontdekking.",
  },
  {
    run: "F",
    name: "DESTIL",
    domain: "destil.nl",
    searchQueryHint: RUN_F_QUERY,
    sources: ["serpapi"],
    location: null,
    sector: null,
    employeeEvidence: "outside_range",
    employeeNotes: "Grote industriële groep — waarschijnlijk buiten 20–200",
    vacancies: [],
    vacancyRoleMatch: "none",
    hiringScore: null,
    opportunityScore: null,
    rejectionReason: "wrong_sector / employee_range",
    failureClass: "unsuitable",
    notes: "Geen softwarebedrijf in doelregio.",
  },
  {
    run: "F",
    name: "OranjeIT",
    domain: "oranjeit.nl",
    searchQueryHint: RUN_F_QUERY,
    sources: ["serpapi"],
    location: "Den Haag",
    sector: "software",
    employeeEvidence: "unknown",
    employeeNotes: "FTE onbekend na enrichment",
    vacancies: ["hint in snippet"],
    vacancyRoleMatch: "not_checked",
    hiringScore: 10,
    opportunityScore: 15,
    rejectionReason: "employee_range_unknown; lage scores",
    failureClass: "insufficient_data",
    notes: "Potentiële kandidaat bij betere FTE + vacature.",
  },
  {
    run: "F",
    name: "JOIN IT Recruitment",
    domain: "joinrecruitment.nl",
    searchQueryHint: RUN_F_QUERY,
    sources: ["serpapi"],
    location: null,
    sector: null,
    employeeEvidence: "not_evaluated",
    employeeNotes: "",
    vacancies: [],
    vacancyRoleMatch: "none",
    hiringScore: null,
    opportunityScore: null,
    rejectionReason: "ai_url_category / recruitment agency",
    failureClass: "misclassification",
    notes: "Run G REJECT jobboard/agency — had niet opgeslagen moeten worden in F.",
  },
  {
    run: "G",
    name: "VDL Groep",
    domain: "vdlgroep.com",
    searchQueryHint: RUN_F_QUERY,
    sources: ["serpapi", "tavily-degraded"],
    location: null,
    sector: null,
    employeeEvidence: "outside_range",
    employeeNotes: "Grote conglomeraat — niet software R'dam/Den Haag",
    vacancies: ["Sales & Marketing"],
    vacancyRoleMatch: "department_noise",
    hiringScore: 0,
    opportunityScore: 0,
    rejectionReason: "no_matching_role",
    failureClass: "misclassification",
    notes: "Enige validate na recall-inval; department label als vacature.",
  },
];