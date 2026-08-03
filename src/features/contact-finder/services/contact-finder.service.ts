import type { CompaniesService, CompaniesServiceContext } from "@/features/companies/services/companies.service";
import { toCompanyId } from "@/features/companies/domain";
import type { ContactsService } from "@/features/contacts/services/contacts.service";
import {
  DEFAULT_TARGET_ROLES,
  type ContactFinderCriteria,
  type ContactFinderProgress,
  type ContactSearchJob,
  type ExternalContactCandidate,
} from "@/features/contact-finder/domain";
import { getContactFinderProviders } from "@/features/contact-finder/providers";
import { enrichCompanyFromOpenCorporates } from "@/features/contact-finder/providers/implementations/opencorporates-utils";
import type { ContactSearchJobRepository } from "@/features/contact-finder/repositories";
import {
  dedupeContactCandidates,
  isDuplicateContactCandidate,
} from "@/features/contact-finder/services/dedupe-candidates";
import { ContactFinderServiceError } from "@/features/contact-finder/services/errors";
import { createContactSearchJobSchema } from "@/features/contact-finder/validation";

export type ContactFinderServiceContext = CompaniesServiceContext;

export type ContactFinderRunEvent =
  | { type: "progress"; progress: ContactFinderProgress }
  | {
      type: "candidate";
      candidate: ExternalContactCandidate;
      saved: boolean;
      skipped: boolean;
    }
  | { type: "complete"; job: ContactSearchJob }
  | { type: "error"; message: string };

function progressPercent(phase: ContactFinderProgress["phase"], providerIndex = 0, providerTotal = 1): number {
  switch (phase) {
    case "starting":
      return 5;
    case "enriching":
      return 20;
    case "searching": {
      const slice = 50 / Math.max(providerTotal, 1);
      return 25 + Math.round(slice * (providerIndex + 1));
    }
    case "deduplicating":
      return 80;
    case "saving":
      return 90;
    case "complete":
      return 100;
    default:
      return 0;
  }
}

export class ContactFinderService {
  constructor(
    private readonly jobRepository: ContactSearchJobRepository,
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
  ) {}

  async createJob(
    context: ContactFinderServiceContext,
    input: { companyId: string; targetRoles?: string[] },
  ): Promise<ContactSearchJob> {
    const parsed = createContactSearchJobSchema.safeParse(input);

    if (!parsed.success) {
      throw new ContactFinderServiceError(
        parsed.error.issues[0]?.message ?? "Ongeldige zoekcriteria.",
      );
    }

    await this.companiesService.getCompany(context, toCompanyId(parsed.data.companyId));

    const criteria: ContactFinderCriteria = {
      companyId: parsed.data.companyId,
      targetRoles: parsed.data.targetRoles ?? [...DEFAULT_TARGET_ROLES],
    };

    return this.jobRepository.create({
      organizationId: context.organizationId,
      userId: context.userId,
      companyId: parsed.data.companyId,
      criteria,
    });
  }

  async *runJob(
    context: ContactFinderServiceContext,
    jobId: string,
  ): AsyncGenerator<ContactFinderRunEvent> {
    const job = await this.jobRepository.findById(context.organizationId, jobId);

    if (!job) {
      yield { type: "error", message: "Zoekjob niet gevonden." };
      return;
    }

    if (job.userId !== context.userId) {
      yield { type: "error", message: "Geen toegang tot deze zoekjob." };
      return;
    }

    if (job.status === "completed") {
      yield { type: "complete", job };
      return;
    }

    if (job.status === "running") {
      yield { type: "error", message: "Deze zoekjob wordt al uitgevoerd." };
      return;
    }

    let currentJob = await this.jobRepository.update(context.organizationId, jobId, {
      status: "running",
      errorMessage: null,
      errorCount: 0,
    });

    const emit = (
      progress: Omit<ContactFinderProgress, "progressPercent"> & { progressPercent?: number },
    ) =>
      ({
        type: "progress",
        progress: {
          ...progress,
          progressPercent:
            progress.progressPercent ??
            progressPercent(progress.phase, 0, getContactFinderProviders().length),
        },
      }) satisfies ContactFinderRunEvent;

    yield emit({
      phase: "starting",
      message: "Contactzoeker gestart…",
      foundCount: 0,
      savedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      progressPercent: 5,
    });

    let errorCount = 0;

    try {
      const company = await this.companiesService.getCompany(
        context,
        toCompanyId(currentJob.companyId),
      );

      yield emit({
        phase: "enriching",
        message: "Bedrijfswebsite en LinkedIn zoeken…",
        foundCount: 0,
        savedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        progressPercent: 15,
      });

      let enrichment;

      try {
        enrichment = await enrichCompanyFromOpenCorporates(company);
      } catch {
        errorCount += 1;
        enrichment = {
          website: company.website,
          linkedInCompanyUrl: null,
        };
      }

      if (!company.website && enrichment.website) {
        try {
          await this.companiesService.updateCompany(context, company.id, {
            website: enrichment.website,
          });
        } catch {
          errorCount += 1;
        }
      }

      yield emit({
        phase: "enriching",
        message: enrichment.website
          ? `Website gevonden: ${enrichment.website}`
          : "Geen website gevonden",
        foundCount: 0,
        savedCount: 0,
        skippedCount: 0,
        errorCount,
        progressPercent: 20,
      });

      if (enrichment.linkedInCompanyUrl) {
        yield emit({
          phase: "enriching",
          message: "LinkedIn bedrijfspagina opgezocht",
          foundCount: 0,
          savedCount: 0,
          skippedCount: 0,
          errorCount,
          progressPercent: 22,
        });
      }

      const providers = getContactFinderProviders();
      const allCandidates: ExternalContactCandidate[] = [];

      for (const [index, provider] of providers.entries()) {
        yield emit({
          phase: "searching",
          message: `Zoeken via ${provider.displayName}…`,
          providerId: provider.id,
          foundCount: allCandidates.length,
          savedCount: 0,
          skippedCount: 0,
          errorCount,
          progressPercent: progressPercent("searching", index, providers.length),
        });

        try {
          const results = await provider.search({
            organizationId: context.organizationId,
            userId: context.userId,
            company,
            enrichment,
            criteria: currentJob.criteria,
          });

          allCandidates.push(...results);

          currentJob = await this.jobRepository.update(context.organizationId, jobId, {
            foundCount: allCandidates.length,
            errorCount,
          });

          yield emit({
            phase: "searching",
            message: `${results.length} contacten via ${provider.displayName}`,
            providerId: provider.id,
            foundCount: allCandidates.length,
            savedCount: 0,
            skippedCount: 0,
            errorCount,
            progressPercent: progressPercent("searching", index, providers.length),
          });
        } catch (error) {
          errorCount += 1;

          yield emit({
            phase: "searching",
            message:
              error instanceof Error
                ? `${provider.displayName}: ${error.message}`
                : `${provider.displayName}: zoeken mislukt`,
            providerId: provider.id,
            foundCount: allCandidates.length,
            savedCount: 0,
            skippedCount: 0,
            errorCount,
            progressPercent: progressPercent("searching", index, providers.length),
          });
        }
      }

      yield emit({
        phase: "deduplicating",
        message: "Duplicaten filteren…",
        foundCount: allCandidates.length,
        savedCount: 0,
        skippedCount: 0,
        errorCount,
        progressPercent: 80,
      });

      const uniqueCandidates = dedupeContactCandidates(allCandidates);
      const { contacts: existingContacts } = await this.contactsService.listContactsByCompany(
        context,
        { companyId: currentJob.companyId, limit: 500 },
      );

      let savedCount = 0;
      let skippedCount = 0;

      for (const candidate of uniqueCandidates) {
        if (isDuplicateContactCandidate(candidate, existingContacts)) {
          skippedCount += 1;
          yield { type: "candidate", candidate, saved: false, skipped: true };
          continue;
        }

        yield emit({
          phase: "saving",
          message: `Opslaan: ${candidate.firstName} ${candidate.lastName}`,
          foundCount: uniqueCandidates.length,
          savedCount,
          skippedCount,
          errorCount,
          progressPercent: 90,
        });

        try {
          const created = await this.contactsService.createContact(context, {
            companyId: currentJob.companyId,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            email: candidate.email,
            phone: candidate.phone,
            jobTitle: candidate.jobTitle,
            linkedinUrl: candidate.linkedinUrl,
            source: candidate.source,
            confidence: candidate.confidence,
            lastVerified: new Date().toISOString(),
          });

          existingContacts.push(created);
          savedCount += 1;
          yield { type: "candidate", candidate, saved: true, skipped: false };
        } catch {
          errorCount += 1;
          skippedCount += 1;
          yield { type: "candidate", candidate, saved: false, skipped: true };
        }
      }

      currentJob = await this.jobRepository.update(context.organizationId, jobId, {
        status: "completed",
        foundCount: uniqueCandidates.length,
        savedCount,
        skippedCount,
        errorCount,
      });

      yield emit({
        phase: "complete",
        message: `${savedCount} contacten toegevoegd`,
        foundCount: uniqueCandidates.length,
        savedCount,
        skippedCount,
        errorCount,
        progressPercent: 100,
      });

      yield { type: "complete", job: currentJob };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Contactzoeker is mislukt.";

      currentJob = await this.jobRepository.update(context.organizationId, jobId, {
        status: "failed",
        errorMessage: message,
        errorCount,
      });

      yield { type: "error", message };
    }
  }
}
