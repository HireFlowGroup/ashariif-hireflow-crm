import { toContactFinderProviderId } from "@/features/contact-finder/domain";
import type { ContactFinderProvider } from "@/features/contact-finder/providers/contact-finder-provider";
import {
  calculateContactConfidence,
  fetchOpenCorporatesOfficers,
  matchesTargetRole,
  resolveOpenCorporatesCompany,
  splitPersonName,
} from "@/features/contact-finder/providers/implementations/opencorporates-utils";

export const openCorporatesContactProvider: ContactFinderProvider = {
  id: toContactFinderProviderId("opencorporates"),
  displayName: "OpenCorporates",
  description: "Bestuurders en statutaire contacten uit het handelsregister",

  async search(context) {
    const match = await resolveOpenCorporatesCompany(context.company);

    if (!match) {
      return [];
    }

    const officers = await fetchOpenCorporatesOfficers(match);

    return officers
      .filter((officer) =>
        matchesTargetRole(officer.position, context.criteria.targetRoles),
      )
      .map((officer) => {
        const { firstName, lastName } = splitPersonName(officer.name ?? "Onbekend");
        const jobTitle = officer.position?.trim() ?? null;

        return {
          firstName,
          lastName,
          email: null,
          phone: null,
          jobTitle,
          linkedinUrl: null,
          source: toContactFinderProviderId("opencorporates"),
          confidence: calculateContactConfidence({
            email: null,
            phone: null,
            linkedinUrl: null,
            jobTitle,
            fromRegistry: true,
          }),
          externalId: officer.opencorporates_url ?? `${match.company_number}:${officer.name}`,
          sourceUrl: officer.opencorporates_url ?? match.opencorporates_url ?? null,
        };
      });
  },
};
