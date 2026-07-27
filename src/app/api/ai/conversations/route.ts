import { NextResponse } from "next/server";
import {
  createConversationRecord,
  listConversationsForUser,
} from "@/lib/ai/conversation-repository";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/server";
import { createConversationSchema } from "@/lib/validations/ai-conversations";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return jsonError(
      "Je bent niet ingelogd. Log opnieuw in om de assistent te gebruiken.",
      401,
    );
  }

  try {
    const conversations = await listConversationsForUser();
    return NextResponse.json({ conversations }, { headers: JSON_HEADERS });
  } catch {
    return jsonError("Gesprekken ophalen mislukt.", 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return jsonError(
      "Je bent niet ingelogd. Log opnieuw in om de assistent te gebruiken.",
      401,
    );
  }

  const profile = await getSessionProfile();

  if (!profile) {
    return jsonError("Gebruikersprofiel niet gevonden.", 403);
  }

  let body: unknown = {};

  try {
    if (request.headers.get("content-length") !== "0") {
      body = await request.json();
    }
  } catch {
    return jsonError("Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = createConversationSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  try {
    const conversation = await createConversationRecord(
      {
        userId: user.id,
        organizationId: profile.organization_id,
      },
      parsed.data.title ?? "Nieuw gesprek",
    );

    return NextResponse.json({ conversation }, { status: 201, headers: JSON_HEADERS });
  } catch {
    return jsonError("Gesprek aanmaken mislukt.", 500);
  }
}
