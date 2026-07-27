"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AiToolDebugPanel,
  type AiToolDebugEntry,
} from "@/components/ai/ai-tool-debug-panel";
import { AiComposer } from "@/components/ai/ai-composer";
import { AiConversationSidebar } from "@/components/ai/ai-conversation-sidebar";
import { AiMessageList } from "@/components/ai/ai-message-list";
import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  readConversationIdFromResponse,
} from "@/components/ai/conversations-api";
import {
  parseChatErrorResponse,
  readChatStream,
} from "@/components/ai/stream-chat-response";
import type { AiChatMessage } from "@/components/ai/types";
import type { ChatStreamToolEvent } from "@/lib/ai/chat/stream-events";
import { AI_CHAT_MESSAGE_MAX_LENGTH } from "@/lib/validations/ai";
import { cn } from "@/lib/utils";
import type { AiMessage } from "@/types/ai";

type AiWorkspaceProps = {
  isConfigured: boolean;
};

const CONVERSATIONS_QUERY_KEY = ["ai-conversations"] as const;

function createMessageId(): string {
  return crypto.randomUUID();
}

function toApiMessages(messages: AiChatMessage[]): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  return messages.map(({ role, content }) => ({ role, content }));
}

function mapStoredMessages(messages: AiMessage[]): AiChatMessage[] {
  return messages
    .filter(
      (message): message is AiMessage & { role: "user" | "assistant" } =>
        message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));
}

export function AiWorkspace({ isConfigured }: AiWorkspaceProps) {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [toolDebugEvents, setToolDebugEvents] = useState<AiToolDebugEntry[]>([]);

  const appendToolEvent = useCallback((event: ChatStreamToolEvent) => {
    setToolDebugEvents((current) => [
      ...current,
      {
        ...event,
        id: createMessageId(),
        at: new Date().toLocaleTimeString("nl-NL"),
      },
    ]);
  }, []);

  const conversationsQuery = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: fetchConversations,
  });

  const createConversationMutation = useMutation({
    mutationFn: () => createConversation(),
    onSuccess: (conversation) => {
      setActiveConversationId(conversation.id);
      setMessages([]);
      setDraft("");
      setErrorMessage(null);
      setToolDebugEvents([]);
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Gesprek aanmaken mislukt.";
      setErrorMessage(message);
    },
  });

  const loadConversation = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    setErrorMessage(null);
    setActiveConversationId(conversationId);

    try {
      const storedMessages = await fetchConversationMessages(conversationId);
      setMessages(mapStoredMessages(storedMessages));
      setToolDebugEvents([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Berichten ophalen mislukt.";
      setErrorMessage(message);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const sendUserMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();

      if (!text || isStreaming || isLoadingMessages) {
        return;
      }

      if (!isConfigured) {
        setErrorMessage(
          "OpenAI is niet geconfigureerd. Stel OPENAI_API_KEY in op de server.",
        );
        return;
      }

      if (text.length > AI_CHAT_MESSAGE_MAX_LENGTH) {
        setErrorMessage(
          `Je bericht is te lang (maximaal ${AI_CHAT_MESSAGE_MAX_LENGTH} tekens).`,
        );
        return;
      }

      setErrorMessage(null);

      const userMessage: AiChatMessage = {
        id: createMessageId(),
        role: "user",
        content: text,
      };

      const assistantMessage: AiChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: "",
      };

      const nextMessages = [...messages, userMessage];

      setMessages([...nextMessages, assistantMessage]);
      setDraft("");
      setIsStreaming(true);
      setStreamingMessageId(assistantMessage.id);

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConversationId ?? undefined,
            messages: toApiMessages(nextMessages),
          }),
        });

        if (!response.ok) {
          const message = await parseChatErrorResponse(response);
          throw new Error(message);
        }

        const conversationIdFromResponse = readConversationIdFromResponse(response);

        if (conversationIdFromResponse) {
          setActiveConversationId(conversationIdFromResponse);
        }

        await readChatStream(
          response,
          (accumulated) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: accumulated }
                  : message,
              ),
            );
          },
          appendToolEvent,
        );

        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Er is een onverwachte fout opgetreden.";

        setErrorMessage(message);
        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessage.id),
        );
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [
      activeConversationId,
      isConfigured,
      isLoadingMessages,
      isStreaming,
      messages,
      queryClient,
      appendToolEvent,
    ],
  );

  function handleSubmitDraft() {
    void sendUserMessage(draft);
  }

  function handleSelectSuggestion(prompt: string) {
    void sendUserMessage(prompt);
  }

  function handleNewChat() {
    if (isStreaming || createConversationMutation.isPending) {
      return;
    }

    createConversationMutation.mutate();
  }

  function handleSelectConversation(conversationId: string) {
    if (isStreaming || conversationId === activeConversationId) {
      return;
    }

    void loadConversation(conversationId);
  }

  const sidebarDisabled =
    !isConfigured || isStreaming || createConversationMutation.isPending;

  return (
    <div
      className={cn(
        "flex h-[min(720px,calc(100vh-14rem))] overflow-hidden rounded-xl border bg-card shadow-sm",
      )}
    >
      <AiConversationSidebar
        conversations={conversationsQuery.data ?? []}
        activeConversationId={activeConversationId}
        isLoading={conversationsQuery.isLoading}
        isCreating={createConversationMutation.isPending}
        disabled={sidebarDisabled}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-hidden">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Gesprek laden…
            </div>
          ) : (
            <AiMessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingMessageId={streamingMessageId}
              composerDisabled={
                !isConfigured || isStreaming || isLoadingMessages
              }
              onSelectSuggestion={handleSelectSuggestion}
            />
          )}
        </div>
        <AiComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmitDraft}
          disabled={!isConfigured || isLoadingMessages}
          isStreaming={isStreaming}
          errorMessage={errorMessage}
        />
      </div>
      <AiToolDebugPanel events={toolDebugEvents} isStreaming={isStreaming} />
    </div>
  );
}
