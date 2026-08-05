import "server-only";

import type { Company } from "@/features/companies/domain";
import { toCompanyId } from "@/features/companies/domain";
import type { CompaniesService, CompaniesServiceContext } from "@/features/companies/services/companies.service";
import type { Contact } from "@/features/contacts/domain";
import type { ContactsService } from "@/features/contacts/services/contacts.service";
import { createEmailVerificationProvider } from "@/features/contact-finder/email-verification";
import { searchCompanyWebsiteContacts } from "@/features/contact-finder/providers/implementations/company-website.provider";
import { searchExistingCrmContacts } from "@/features/contact-finder/providers/implementations/existing-crm.provider";
import { searchVerifiedGeneralMailboxes } from "@/features/contact-finder/providers/implementations/general-mailbox.provider";
import { searchTavilyContacts } from "@/features/contact-finder/providers/implementations/tavily-contact.provider";
import {
  rankDiscoveredContacts,
  selectBestDiscoveredContact,
  toSelectedAlternatives,
} from "@/features/contact-finder/services/contact-scoring.service";
import {
  type ContactDiscoveryResult,
  type ContactFinderTraceEntry,
  type DiscoveredContactCandidate,
  rejectContactCandidate,
} from "@/features/contact-finder/services/contact-validation.service";
import type { SupabaseClient } from "@supabase/supabase-js";

const COMPANY_TIMEOUT_MS = 20_000;
const WEBSITE_TIMEOUT_MS = 8_000;

export type ContactDiscoveryContext = CompaniesServiceContext & {
  runId?: string;
  runItemId?: string;
};

export class ContactDiscoveryEngine {
  private readonly verifier = createEmailVerificationProvider();

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly supabase?: SupabaseClient,
  ) {}

  async discoverForCompany(
    context: ContactDiscoveryContext,
    input: {
      companyId: string;
      targetRoles: string[];
      suppressedEmails?: Set<string>;
      bouncedEmails?: Set<string>;
    },
  ): Promise<ContactDiscoveryResult> {
    const startedAt = Date.now();
    const traces: ContactFinderTraceEntry[] = [];
    const suppressed = input.suppressedEmails ?? new Set<string>();
    const bounced = input.bouncedEmails ?? new Set<string>();

    try {
      const company = await this.companiesService.getCompany(context, toCompanyId(input.companyId));
      const { contacts: existingContacts } = await this.contactsService.listContactsByCompany(context, {
        companyId: input.companyId,
        limit: 500,
      });

      const allCandidates: DiscoveredContactCandidate[] = [];

      // A. Existing CRM
      const crmStarted = Date.now();
      const crmCandidates = searchExistingCrmContacts(existingContacts, company);
      allCandidates.push(...crmCandidates);
      traces.push(
        await this.persistTrace(context, {
          company,
          provider: "existing_crm",
          query: `company_id=${input.companyId}`,
          startedAt: crmStarted,
          rawResultCount: existingContacts.length,
          normalizedCount: crmCandidates.length,
          candidates: crmCandidates,
          suppressed,
          bounced,
        }),
      );

      if (Date.now() - startedAt > COMPANY_TIMEOUT_MS) {
        return this.finalize(allCandidates, company, traces, suppressed, bounced, "contact_lookup_failed", "Timeout tijdens CRM-zoekopdracht");
      }

      // B. Company website
      const webStarted = Date.now();
      let webCandidates: DiscoveredContactCandidate[] = [];
      try {
        const web = await searchCompanyWebsiteContacts(company, WEBSITE_TIMEOUT_MS);
        webCandidates = web.candidates;
        allCandidates.push(...webCandidates);
        traces.push(
          await this.persistTrace(context, {
            company,
            provider: "company_website",
            query: web.sourceUrl,
            startedAt: webStarted,
            rawResultCount: web.pagesFetched,
            normalizedCount: webCandidates.length,
            candidates: webCandidates,
            suppressed,
            bounced,
          }),
        );
      } catch (error) {
        traces.push(
          await this.persistTrace(context, {
            company,
            provider: "company_website",
            query: company.website,
            startedAt: webStarted,
            rawResultCount: 0,
            normalizedCount: 0,
            candidates: [],
            suppressed,
            bounced,
            error: error instanceof Error ? error.message : "Website crawl mislukt",
          }),
        );
      }

      // C. Tavily public search
      const tavilyStarted = Date.now();
      try {
        const tavily = await searchTavilyContacts(company);
        allCandidates.push(...tavily.candidates);
        traces.push(
          await this.persistTrace(context, {
            company,
            provider: "tavily_search",
            query: tavily.queries.join(" | "),
            startedAt: tavilyStarted,
            rawResultCount: tavily.rawCount,
            normalizedCount: tavily.candidates.length,
            candidates: tavily.candidates,
            suppressed,
            bounced,
          }),
        );
      } catch (error) {
        traces.push(
          await this.persistTrace(context, {
            company,
            provider: "tavily_search",
            query: company.name,
            startedAt: tavilyStarted,
            rawResultCount: 0,
            normalizedCount: 0,
            candidates: [],
            suppressed,
            bounced,
            error: error instanceof Error ? error.message : "Tavily search mislukt",
          }),
        );
      }

      // D. Verified general mailbox fallback
      const mailboxStarted = Date.now();
      try {
        const mailboxes = await searchVerifiedGeneralMailboxes(company, this.verifier);
        allCandidates.push(...mailboxes);
        traces.push(
          await this.persistTrace(context, {
            company,
            provider: "general_mailbox",
            query: company.domain ?? company.website,
            startedAt: mailboxStarted,
            rawResultCount: mailboxes.length,
            normalizedCount: mailboxes.length,
            candidates: mailboxes,
            suppressed,
            bounced,
          }),
        );
      } catch (error) {
        traces.push(
          await this.persistTrace(context, {
            company,
            provider: "general_mailbox",
            query: company.domain ?? company.website,
            startedAt: mailboxStarted,
            rawResultCount: 0,
            normalizedCount: 0,
            candidates: [],
            suppressed,
            bounced,
            error: error instanceof Error ? error.message : "Mailbox fallback mislukt",
          }),
        );
      }

      return this.finalize(allCandidates, company, traces, suppressed, bounced, null, null, existingContacts, context);
    } catch (error) {
      return {
        stage: "contact_lookup_failed",
        selected: null,
        alternatives: [],
        traces,
        errorMessage: error instanceof Error ? error.message : "Contact discovery mislukt",
      };
    }
  }

  private async finalize(
    rawCandidates: DiscoveredContactCandidate[],
    company: Company,
    traces: ContactFinderTraceEntry[],
    suppressed: Set<string>,
    bounced: Set<string>,
    forcedStage: ContactDiscoveryResult["stage"] | null,
    forcedMessage: string | null,
    existingContacts: Contact[] = [],
    context?: ContactDiscoveryContext,
  ): Promise<ContactDiscoveryResult> {
    const deduped = dedupeCandidates(rawCandidates);
    const validated: Array<DiscoveredContactCandidate & { relevanceScore: number }> = [];

    for (const candidate of deduped) {
      if (!candidate.email) continue;

      const verification =
        candidate.verification ?? (await this.verifier.verify(candidate.email, company.domain ?? undefined));

      const enriched = { ...candidate, verification };
      const rejection = rejectContactCandidate(enriched, company, verification, {
        suppressedEmails: suppressed,
        bouncedEmails: bounced,
        hasExplicitCompanySource: enriched.emailOrigin === "published" || enriched.sourceType === "company_website",
      });

      if (rejection) continue;

      validated.push({
        ...enriched,
        relevanceScore: 0,
      });
    }

    const ranked = rankDiscoveredContacts(validated, company);
    const selected = selectBestDiscoveredContact(ranked);
    const alternatives = toSelectedAlternatives(ranked, selected?.email ?? null);

    if (forcedStage) {
      return {
        stage: forcedStage,
        selected: null,
        alternatives,
        traces,
        errorMessage: forcedMessage,
      };
    }

    if (!selected) {
      return {
        stage: "blocked_missing_contact",
        selected: null,
        alternatives,
        traces,
        errorMessage: "Geen bruikbaar recruitment- of HR-contact gevonden. Controleer de website of voeg handmatig een ontvanger toe.",
      };
    }

    let contactId = selected.contactId;
    if (context && !contactId) {
      contactId = await this.upsertDiscoveredContact(context, company.id as string, ranked.find((r) => r.email === selected.email)!);
    }

    const stage = selected.isGeneralMailbox ? "general_mailbox_found" : "contact_found";

    return {
      stage,
      selected: { ...selected, contactId },
      alternatives,
      traces,
      errorMessage: null,
    };
  }

  private async upsertDiscoveredContact(
    context: ContactDiscoveryContext,
    companyId: string,
    candidate: DiscoveredContactCandidate & { relevanceScore: number },
  ): Promise<string | null> {
    if (!candidate.email) return null;

    try {
      const created = await this.contactsService.createContact(context, {
        companyId,
        firstName: candidate.firstName || "Contact",
        lastName: candidate.lastName || "",
        email: candidate.email,
        phone: candidate.phone,
        jobTitle: candidate.jobTitle,
        linkedinUrl: candidate.linkedinUrl,
        source: candidate.sourceType,
        confidence: candidate.confidence,
        lastVerified: new Date().toISOString(),
      });
      return created.id as string;
    } catch {
      return candidate.existingContactId ?? null;
    }
  }

  private async persistTrace(
    context: ContactDiscoveryContext,
    input: {
      company: Company;
      provider: string;
      query: string | null;
      startedAt: number;
      rawResultCount: number;
      normalizedCount: number;
      candidates: DiscoveredContactCandidate[];
      suppressed: Set<string>;
      bounced: Set<string>;
      error?: string;
    },
  ): Promise<ContactFinderTraceEntry> {
    const rejectionReasons: ContactFinderTraceEntry["rejectionReasons"] = [];
    let validCount = 0;

    for (const candidate of input.candidates) {
      if (!candidate.email) {
        rejectionReasons.push({ code: "missing_email", message: "Geen e-mail" });
        continue;
      }
      const verification = candidate.verification ?? (await this.verifier.verify(candidate.email, input.company.domain ?? undefined));
      const rejection = rejectContactCandidate(
        { ...candidate, verification },
        input.company,
        verification,
        { suppressedEmails: input.suppressed, bouncedEmails: input.bounced },
      );
      if (rejection) {
        rejectionReasons.push(rejection);
      } else {
        validCount += 1;
      }
    }

    const entry: ContactFinderTraceEntry = {
      companyId: input.company.id as string,
      companyName: input.company.name,
      companyDomain: input.company.domain,
      provider: input.provider,
      query: input.query,
      startedAt: new Date(input.startedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - input.startedAt,
      rawResultCount: input.rawResultCount,
      normalizedCount: input.normalizedCount,
      validCount,
      rejectedCount: Math.max(0, input.normalizedCount - validCount),
      rejectionReasons,
      error: input.error ?? null,
    };

    if (this.supabase) {
      await this.supabase.from("contact_finder_traces").insert({
        organization_id: context.organizationId,
        run_id: context.runId ?? null,
        run_item_id: context.runItemId ?? null,
        company_id: entry.companyId,
        company_name: entry.companyName,
        company_domain: entry.companyDomain,
        provider: entry.provider,
        query: entry.query,
        started_at: entry.startedAt,
        completed_at: entry.completedAt,
        duration_ms: entry.durationMs,
        raw_result_count: entry.rawResultCount,
        normalized_count: entry.normalizedCount,
        valid_count: entry.validCount,
        rejected_count: entry.rejectedCount,
        rejection_reasons: entry.rejectionReasons,
        error: entry.error,
      });
    }

    console.info("[ContactDiscovery]", entry);
    return entry;
  }
}

function dedupeCandidates(candidates: DiscoveredContactCandidate[]): DiscoveredContactCandidate[] {
  const map = new Map<string, DiscoveredContactCandidate>();
  for (const candidate of candidates) {
    if (!candidate.email) continue;
    const key = candidate.email.toLowerCase();
    const existing = map.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      map.set(key, candidate);
    }
  }
  return [...map.values()];
}

export function createContactDiscoveryEngine(
  companiesService: CompaniesService,
  contactsService: ContactsService,
  supabase?: SupabaseClient,
): ContactDiscoveryEngine {
  return new ContactDiscoveryEngine(companiesService, contactsService, supabase);
}
