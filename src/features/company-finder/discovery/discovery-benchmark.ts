/**
 * Development-only benchmark reference list.
 * NEVER injected into production discovery results.
 */

export type DiscoveryBenchmarkCompany = {
  name: string;
  expectedDomain: string | null;
  city: string;
};

export const ROTTERDAM_DEN_HAAG_SOFTWARE_REFERENCE: DiscoveryBenchmarkCompany[] = [
  { name: "Betabit", expectedDomain: "betabit.nl", city: "Rotterdam" },
  { name: "DEPT", expectedDomain: "deptagency.com", city: "Den Haag" },
  { name: "Yellow Yard", expectedDomain: "yellowyard.nl", city: "Rotterdam" },
  { name: "Empowerary", expectedDomain: "empowerary.com", city: "Rotterdam" },
  { name: "Simac", expectedDomain: "simac.com", city: "Den Haag" },
  { name: "Costomy", expectedDomain: "costomy.com", city: "Rotterdam" },
  { name: "Bluetick", expectedDomain: "bluetick.nl", city: "Rotterdam" },
  { name: "Inergy", expectedDomain: "inergy.nl", city: "Den Haag" },
  { name: "Enable U", expectedDomain: "enableu.nl", city: "Den Haag" },
  { name: "Cquens", expectedDomain: "cquens.com", city: "Rotterdam" },
];

export type BenchmarkMatchResult = {
  reference: DiscoveryBenchmarkCompany;
  found: boolean;
  classifiedAsCompany: boolean;
  hasOfficialDomain: boolean;
  hasVacancyEvidence: boolean;
  wronglyRejected: boolean;
  matchedName: string | null;
  matchedDomain: string | null;
};

export type BenchmarkReport = {
  referenceCount: number;
  foundCount: number;
  classifiedCount: number;
  officialDomainCount: number;
  vacancyEvidenceCount: number;
  wronglyRejectedCount: number;
  recall: number;
  precision: number;
  matches: BenchmarkMatchResult[];
};

export function evaluateDiscoveryBenchmark(input: {
  acceptedCompanies: Array<{
    name: string;
    domain: string | null;
    hasVacancyEvidence: boolean;
  }>;
  rejectedCompanies: Array<{ name: string; reason: string | null }>;
}): BenchmarkReport {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

  const matches: BenchmarkMatchResult[] = ROTTERDAM_DEN_HAAG_SOFTWARE_REFERENCE.map((reference) => {
    const refNorm = normalize(reference.name);
    const accepted = input.acceptedCompanies.find(
      (c) => normalize(c.name).includes(refNorm) || refNorm.includes(normalize(c.name)),
    );
    const rejected = input.rejectedCompanies.find(
      (c) => normalize(c.name).includes(refNorm) || refNorm.includes(normalize(c.name)),
    );

    return {
      reference,
      found: Boolean(accepted),
      classifiedAsCompany: Boolean(accepted),
      hasOfficialDomain: Boolean(accepted?.domain),
      hasVacancyEvidence: Boolean(accepted?.hasVacancyEvidence),
      wronglyRejected: !accepted && Boolean(rejected),
      matchedName: accepted?.name ?? rejected?.name ?? null,
      matchedDomain: accepted?.domain ?? null,
    };
  });

  const foundCount = matches.filter((m) => m.found).length;
  const classifiedCount = matches.filter((m) => m.classifiedAsCompany).length;
  const officialDomainCount = matches.filter((m) => m.hasOfficialDomain).length;
  const vacancyEvidenceCount = matches.filter((m) => m.hasVacancyEvidence).length;
  const wronglyRejectedCount = matches.filter((m) => m.wronglyRejected).length;

  const recall = foundCount / ROTTERDAM_DEN_HAAG_SOFTWARE_REFERENCE.length;
  const falsePositives = Math.max(
    0,
    input.acceptedCompanies.length - classifiedCount,
  );
  const precision =
    input.acceptedCompanies.length === 0
      ? 0
      : classifiedCount / (classifiedCount + falsePositives);

  return {
    referenceCount: ROTTERDAM_DEN_HAAG_SOFTWARE_REFERENCE.length,
    foundCount,
    classifiedCount,
    officialDomainCount,
    vacancyEvidenceCount,
    wronglyRejectedCount,
    recall,
    precision,
    matches,
  };
}
