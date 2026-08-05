import { NextResponse } from "next/server";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { processIncomingReply } from "@/features/ai-recruiter/services/incoming-reply.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterProcessReplyBodySchema } from "@/lib/validations/ai-recruiter-api";

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = aiRecruiterProcessReplyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" },
      { status: 400 },
    );
  }

  const repository = parsed.data.persist !== false ? await createAiRecruiterRepository() : null;

  try {
    const result = await processIncomingReply(repository, context.organizationId, {
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName ?? null,
      originalSubject: parsed.data.originalSubject ?? null,
      isGeneralMailbox: parsed.data.isGeneralMailbox,
      contactEmail: parsed.data.contactEmail ?? null,
      outreachMessageId: parsed.data.outreachMessageId,
      runItemId: parsed.data.runItemId ?? null,
      persist: parsed.data.persist,
    });

    console.log("[AI Recruiter] reply classified", {
      classification: result.classification,
      confidence: result.analysis.confidence,
      shouldSend: result.suggestedReply.shouldSend,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[AI Recruiter] reply process failed", error);
    const message = error instanceof Error ? error.message : "Reactie kon niet worden verwerkt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
