import { NextResponse } from "next/server";
import { APIConnectionError } from "openai";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import {
  getOpenAIClient,
  streamModelResponseWithTools,
} from "@/lib/ai";
import {
  insertConversationMessage,
  maybeUpdateConversationTitle,
  resolveConversationForChat,
  touchConversationUpdatedAt,
} from "@/lib/ai/conversation-repository";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/server";
import { aiChatStreamRequestSchema } from "@/lib/validations/ai";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

function methodNotAllowedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Alleen POST-verzoeken zijn toegestaan." },
    { status: 405, headers: { Allow: "POST", ...JSON_HEADERS } },
  );
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}

export function GET(): NextResponse {
  return methodNotAllowedResponse();
}

export function PUT(): NextResponse {
  return methodNotAllowedResponse();
}

export function PATCH(): NextResponse {
  return methodNotAllowedResponse();
}

export function DELETE(): NextResponse {
  return methodNotAllowedResponse();
}

export async function POST(request: Request): Promise<Response> {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Ongeldige JSON in het verzoek.", 400);
  }

  const parsed = aiChatStreamRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    return jsonError(message, 400);
  }

  const latestUserMessage = [...parsed.data.messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return jsonError("Het laatste bericht moet van de gebruiker zijn.", 400);
  }

  let openai;

  try {
    openai = getOpenAIClient();
  } catch {
    return jsonError(
      "De AI-assistent is momenteel niet beschikbaar. Probeer het later opnieuw.",
      500,
    );
  }

  const conversationContext = {
    userId: user.id,
    organizationId: profile.organization_id,
  };

  let activeConversationId: string;

  try {
    activeConversationId = await resolveConversationForChat(
      conversationContext,
      parsed.data.conversationId,
      latestUserMessage.content,
    );

    await insertConversationMessage(
      conversationContext,
      activeConversationId,
      "user",
      latestUserMessage.content,
    );
    await maybeUpdateConversationTitle(
      activeConversationId,
      latestUserMessage.content,
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Gesprek niet gevonden."
        ? error.message
        : "Gesprek kon niet worden opgeslagen.";

    const status = message === "Gesprek niet gevonden." ? 404 : 500;
    return jsonError(message, status);
  }

  const input: EasyInputMessage[] = parsed.data.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  try {
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantContent = "";

        try {
          const finalText = await streamModelResponseWithTools({
            client: openai,
            input,
            context: conversationContext,
            onTextDelta: (delta) => {
              assistantContent += delta;
              controller.enqueue(encoder.encode(delta));
            },
          });

          controller.close();

          const trimmed = (finalText || assistantContent).trim();

          if (trimmed) {
            await insertConversationMessage(
              conversationContext,
              activeConversationId,
              "assistant",
              trimmed,
            );
            await touchConversationUpdatedAt(activeConversationId);
          }
        } catch (streamError) {
          console.error("[api/ai/chat] Streaming mislukt");
          controller.error(streamError);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
        "X-Conversation-Id": activeConversationId,
      },
    });
  } catch (error) {
    if (error instanceof APIConnectionError) {
      return jsonError(
        "De AI-dienst is tijdelijk niet bereikbaar. Probeer het later opnieuw.",
        500,
      );
    }

    console.error("[api/ai/chat] OpenAI-verzoek mislukt");
    return jsonError(
      "Er ging iets mis bij het genereren van een antwoord. Probeer het opnieuw.",
      500,
    );
  }
}
