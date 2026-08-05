import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { createContactDiscoveryEngine } from "@/features/contact-finder/create-contact-discovery-engine";
import { createContactsServiceFromClient } from "@/features/contacts/create-contacts-service";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createClient } from "@/lib/supabase/server";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";

const itemIdSchema = z.string().uuid("itemId moet een geldige UUID zijn.");

const contactActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("select"),
    email: z.string().email(),
  }),
  z.object({
    action: z.literal("retry"),
  }),
  z.object({
    action: z.literal("block"),
    email: z.string().email(),
  }),
  z.object({
    action: z.literal("mark-invalid"),
    email: z.string().email(),
  }),
  z.object({
    action: z.literal("add-manual"),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    jobTitle: z.string().optional(),
  }),
]);

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

export async function POST(request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId: rawRunId, itemId: rawItemId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);
  const itemIdResult = itemIdSchema.safeParse(rawItemId);

  if (!runIdResult.success || !itemIdResult.success) {
    return NextResponse.json({ error: "Ongeldige parameters" }, { status: 400 });
  }

  let body: z.infer<typeof contactActionSchema>;
  try {
    body = contactActionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige actie" }, { status: 400 });
  }

  const runId = runIdResult.data;
  const itemId = itemIdResult.data;
  const repository = await createAiRecruiterRepository();
  const item = await repository.getRunItem(context.organizationId, itemId);

  if (!item || item.runId !== runId) {
    return NextResponse.json({ error: "Run item niet gevonden" }, { status: 404 });
  }

  const authClient = await createClient();
  const contactsService = createContactsServiceFromClient(authClient);
  const outreachEngine = await createOutreachEngineService();

  try {
    if (body.action === "block") {
      await outreachEngine.optOut(context, {
        email: body.email.toLowerCase(),
        reason: "Handmatig geblokkeerd via prospect review",
        companyId: item.companyId ?? undefined,
        contactId: item.selectedContactId ?? undefined,
      });

      const updated = await repository.updateRunItem(context.organizationId, itemId, {
        rejectionReason: `Adres geblokkeerd: ${body.email}`,
        status: "skipped",
        stage: "blocked_missing_contact",
      });
      return NextResponse.json({ item: updated });
    }

    if (body.action === "mark-invalid") {
      await outreachEngine.optOut(context, {
        email: body.email.toLowerCase(),
        reason: "Handmatig ongeldig gemarkeerd via prospect review",
        companyId: item.companyId ?? undefined,
        contactId: item.selectedContactId ?? undefined,
      });

      const updated = await repository.updateRunItem(context.organizationId, itemId, {
        selectedContactId: null,
        rejectionReason: `Contact gemarkeerd als ongeldig: ${body.email}`,
        status: "skipped",
        stage: "blocked_missing_contact",
      });
      return NextResponse.json({ item: updated });
    }

    if (body.action === "add-manual") {
      if (!item.companyId) {
        return NextResponse.json({ error: "Geen bedrijf gekoppeld" }, { status: 400 });
      }

      const created = await contactsService.createContact(context, {
        companyId: item.companyId,
        firstName: body.firstName ?? "Contact",
        lastName: body.lastName ?? "",
        email: body.email,
        jobTitle: body.jobTitle ?? null,
        source: "manual",
        confidence: 1,
        lastVerified: new Date().toISOString(),
      });

      const updated = await repository.updateRunItem(context.organizationId, itemId, {
        selectedContactId: created.id as string,
        stage: "contact_found",
        status: "completed",
        externalCompanyData: {
          contactDiscovery: {
            stage: "contact_found",
            selected: {
              contactId: created.id,
              email: body.email,
              recipientName: `${body.firstName ?? ""} ${body.lastName ?? ""}`.trim() || null,
              jobTitle: body.jobTitle ?? null,
              sourceType: "manual",
              verificationStatus: "likely",
              relevanceScore: 90,
              isGeneralMailbox: false,
              selectionReason: "Handmatig toegevoegd",
            },
            alternatives: [],
            errorMessage: null,
          },
        },
      });
      return NextResponse.json({ item: updated });
    }

    if (body.action === "select") {
      const discovery = item.externalCompanyData.contactDiscovery as
        | {
            alternatives?: Array<{
              email: string;
              contactId?: string | null;
              recipientName?: string | null;
              jobTitle?: string | null;
              sourceType?: string;
              verificationStatus?: string;
              relevanceScore?: number;
              isGeneralMailbox?: boolean;
              selectionReason?: string;
            }>;
            selected?: unknown;
          }
        | undefined;

      const alternative = discovery?.alternatives?.find((alt) => alt.email === body.email);
      if (!alternative) {
        return NextResponse.json({ error: "Alternatief niet gevonden" }, { status: 404 });
      }

      const updated = await repository.updateRunItem(context.organizationId, itemId, {
        selectedContactId: alternative.contactId ?? item.selectedContactId,
        stage: alternative.isGeneralMailbox ? "general_mailbox_found" : "contact_found",
        externalCompanyData: {
          contactDiscovery: {
            ...(discovery ?? {}),
            selected: {
              ...alternative,
              selectionReason: "Handmatig geselecteerd alternatief",
            },
            errorMessage: null,
          },
        },
      });
      return NextResponse.json({ item: updated });
    }

    if (body.action === "retry") {
      if (!item.companyId) {
        return NextResponse.json({ error: "Geen bedrijf gekoppeld" }, { status: 400 });
      }

      const run = await repository.getRun(context.organizationId, runId);
      if (!run) return NextResponse.json({ error: "Run niet gevonden" }, { status: 404 });

      const engine = await createContactDiscoveryEngine(authClient, contactsService);
      const result = await engine.discoverForCompany(
        { ...context, runId, runItemId: itemId },
        {
          companyId: item.companyId,
          targetRoles: run.searchCriteria.contact_roles,
        },
      );

      const updated = await repository.updateRunItem(context.organizationId, itemId, {
        stage: result.stage,
        status: result.selected ? "completed" : "skipped",
        selectedContactId: result.selected?.contactId ?? null,
        rejectionReason: result.errorMessage,
        externalCompanyData: {
          contactDiscovery: {
            stage: result.stage,
            selected: result.selected,
            alternatives: result.alternatives,
            errorMessage: result.errorMessage,
          },
        },
      });

      return NextResponse.json({ item: updated, discovery: result });
    }

    return NextResponse.json({ error: "Onbekende actie" }, { status: 400 });
  } catch (error) {
    console.error("[AI Recruiter] contact action failed", error);
    const message = error instanceof Error ? error.message : "Actie mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
