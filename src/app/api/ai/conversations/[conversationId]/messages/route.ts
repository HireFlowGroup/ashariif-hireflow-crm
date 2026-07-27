import { NextResponse } from "next/server";
import {
  getConversationForUser,
  listMessagesForConversation,
} from "@/lib/ai/conversation-repository";
import { getSessionUser } from "@/lib/supabase/server";
import { conversationIdParamSchema } from "@/lib/validations/ai-conversations";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return jsonError(
      "Je bent niet ingelogd. Log opnieuw in om de assistent te gebruiken.",
      401,
    );
  }

  const { conversationId } = await context.params;
  const idParsed = conversationIdParamSchema.safeParse(conversationId);

  if (!idParsed.success) {
    return jsonError("Ongeldig gesprek-id.", 400);
  }

  try {
    const conversation = await getConversationForUser(idParsed.data);

    if (!conversation) {
      return jsonError("Gesprek niet gevonden.", 404);
    }

    const messages = await listMessagesForConversation(idParsed.data);

    return NextResponse.json({ messages }, { headers: JSON_HEADERS });
  } catch {
    return jsonError("Berichten ophalen mislukt.", 500);
  }
}
