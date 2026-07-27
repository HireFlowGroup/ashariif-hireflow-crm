import {
  deriveConversationTitle,
  isDefaultConversationTitle,
} from "@/lib/ai/conversation-utils";
import { createClient } from "@/lib/supabase/server";
import type { AiConversation, AiMessage, AiMessageRole } from "@/types/ai";

type ConversationContext = {
  userId: string;
  organizationId: string;
};

export async function listConversationsForUser(): Promise<AiConversation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Gesprekken ophalen mislukt.");
  }

  return data ?? [];
}

export async function createConversationRecord(
  context: ConversationContext,
  title = "Nieuw gesprek",
): Promise<AiConversation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      organization_id: context.organizationId,
      user_id: context.userId,
      title,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Gesprek aanmaken mislukt.");
  }

  return data;
}

export async function getConversationForUser(
  conversationId: string,
): Promise<AiConversation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw new Error("Gesprek ophalen mislukt.");
  }

  return data;
}

export async function listMessagesForConversation(
  conversationId: string,
): Promise<AiMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Berichten ophalen mislukt.");
  }

  return data ?? [];
}

export async function insertConversationMessage(
  context: ConversationContext,
  conversationId: string,
  role: AiMessageRole,
  content: string,
): Promise<AiMessage> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      organization_id: context.organizationId,
      role,
      content,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Bericht opslaan mislukt.");
  }

  return data;
}

export async function touchConversationUpdatedAt(
  conversationId: string,
): Promise<void> {
  const supabase = await createClient();
  const updatedAt = new Date().toISOString();

  const { error } = await supabase
    .from("ai_conversations")
    .update({ updated_at: updatedAt })
    .eq("id", conversationId);

  if (error) {
    throw new Error("Gesprek bijwerken mislukt.");
  }
}

export async function maybeUpdateConversationTitle(
  conversationId: string,
  userMessage: string,
): Promise<void> {
  const conversation = await getConversationForUser(conversationId);

  if (!conversation || !isDefaultConversationTitle(conversation.title)) {
    return;
  }

  const supabase = await createClient();
  const title = deriveConversationTitle(userMessage);

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    throw new Error("Gesprektitel bijwerken mislukt.");
  }
}

export async function resolveConversationForChat(
  context: ConversationContext,
  conversationId: string | undefined,
  latestUserMessage: string,
): Promise<string> {
  if (conversationId) {
    const existing = await getConversationForUser(conversationId);

    if (!existing) {
      throw new Error("Gesprek niet gevonden.");
    }

    return conversationId;
  }

  const created = await createConversationRecord(
    context,
    deriveConversationTitle(latestUserMessage),
  );

  return created.id;
}
