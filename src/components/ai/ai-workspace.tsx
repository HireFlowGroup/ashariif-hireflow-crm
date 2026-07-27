"use client";

import { useCallback, useState } from "react";
import { AiComposer } from "@/components/ai/ai-composer";
import { AiMessageList } from "@/components/ai/ai-message-list";
import {
  parseChatErrorResponse,
  readChatStream,
} from "@/components/ai/stream-chat-response";
import type { AiChatMessage } from "@/components/ai/types";
import { AI_CHAT_MESSAGE_MAX_LENGTH } from "@/lib/validations/ai";
import { cn } from "@/lib/utils";

type AiWorkspaceProps = {
  isConfigured: boolean;
};

function createMessageId(): string {
  return crypto.randomUUID();
}

function toApiMessages(messages: AiChatMessage[]): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function AiWorkspace({ isConfigured }: AiWorkspaceProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendUserMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();

      if (!text || isStreaming) {
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
          body: JSON.stringify({ messages: toApiMessages(nextMessages) }),
        });

        if (!response.ok) {
          const message = await parseChatErrorResponse(response);
          throw new Error(message);
        }

        await readChatStream(response, (accumulated) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: accumulated }
                : message,
            ),
          );
        });
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
    [isConfigured, isStreaming, messages],
  );

  function handleSubmitDraft() {
    void sendUserMessage(draft);
  }

  function handleSelectSuggestion(prompt: string) {
    void sendUserMessage(prompt);
  }

  return (
    <div
      className={cn(
        "flex h-[min(720px,calc(100vh-14rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
      )}
    >
      <div className="flex-1 overflow-hidden">
        <AiMessageList
          messages={messages}
          isStreaming={isStreaming}
          streamingMessageId={streamingMessageId}
          composerDisabled={!isConfigured || isStreaming}
          onSelectSuggestion={handleSelectSuggestion}
        />
      </div>
      <AiComposer
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmitDraft}
        disabled={!isConfigured}
        isStreaming={isStreaming}
        errorMessage={errorMessage}
      />
    </div>
  );
}
