export type AiConversation = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AiMessageRole = "user" | "assistant" | "system";

export type AiMessage = {
  id: string;
  conversation_id: string;
  organization_id: string;
  role: AiMessageRole;
  content: string;
  tool_name: string | null;
  created_at: string;
};

export type AiConversationSummary = Pick<
  AiConversation,
  "id" | "title" | "updated_at" | "created_at"
>;
