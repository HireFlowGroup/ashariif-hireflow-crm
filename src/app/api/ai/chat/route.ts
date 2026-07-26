import { NextResponse } from "next/server";
import { isOpenAIConfigured } from "@/lib/env";
import {
  getOpenAIClient,
  openAIRecruitingSystemPrompt,
} from "@/lib/openai/client";
import { getSessionUser } from "@/lib/supabase/server";
import { aiChatRequestSchema } from "@/lib/validations/ai";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI is not configured on the server" },
      { status: 503 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = aiChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: openAIRecruitingSystemPrompt },
        { role: "user", content: parsed.data.message },
      ],
      temperature: 0.4,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: "The model returned an empty response" },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process AI request";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
