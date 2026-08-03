"use client";

import { useEffect, useRef } from "react";
import { AiMessageBubble } from "@/components/ai/ai-message-bubble";
import { CopilotWelcomeScreen } from "@/components/ai/copilot-welcome-screen";
import { AiWelcomeScreen } from "@/components/ai/ai-welcome-screen";
import type { AiChatMessage } from "@/components/ai/types";
import { ScrollArea } from "@/components/ui/scroll-area";

type AiMessageListProps = {
  messages: AiChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  composerDisabled?: boolean;
  onSelectSuggestion: (prompt: string) => void;
  useCopilotWelcome?: boolean;
};

export function AiMessageList({
  messages,
  isStreaming,
  streamingMessageId,
  composerDisabled = false,
  onSelectSuggestion,
  useCopilotWelcome = false,
}: AiMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    const Welcome = useCopilotWelcome ? CopilotWelcomeScreen : AiWelcomeScreen;

    return (
      <Welcome
        disabled={composerDisabled}
        onSelectSuggestion={onSelectSuggestion}
      />
    );
  }

  return (
    <ScrollArea className="h-full px-4 py-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <AiMessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            isStreaming={isStreaming && message.id === streamingMessageId}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
