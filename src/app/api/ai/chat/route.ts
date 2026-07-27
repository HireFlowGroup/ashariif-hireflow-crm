import { NextResponse } from "next/server";
import { APIConnectionError } from "openai";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import {
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  getOpenAIClient,
  HIREFLOW_SYSTEM_PROMPT,
  MAX_OUTPUT_TOKENS,
} from "@/lib/ai";
import { getSessionUser } from "@/lib/supabase/server";
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

  let openai;

  try {
    openai = getOpenAIClient();
  } catch {
    return jsonError(
      "De AI-assistent is momenteel niet beschikbaar. Probeer het later opnieuw.",
      500,
    );
  }

  const input: EasyInputMessage[] = parsed.data.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  try {
    const openaiStream = await openai.responses.create({
      model: DEFAULT_MODEL,
      instructions: HIREFLOW_SYSTEM_PROMPT,
      input,
      stream: true,
      temperature: DEFAULT_TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of openaiStream) {
            if (event.type === "response.output_text.delta" && event.delta) {
              controller.enqueue(encoder.encode(event.delta));
            }
          }
          controller.close();
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
