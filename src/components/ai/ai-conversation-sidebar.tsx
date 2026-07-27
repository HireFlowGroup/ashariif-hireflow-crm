"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AiConversationSummary } from "@/types/ai";

type AiConversationSidebarProps = {
  conversations: AiConversationSummary[];
  activeConversationId: string | null;
  isLoading?: boolean;
  isCreating?: boolean;
  disabled?: boolean;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
};

function formatConversationDate(isoDate: string): string {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AiConversationSidebar({
  conversations,
  activeConversationId,
  isLoading = false,
  isCreating = false,
  disabled = false,
  onSelectConversation,
  onNewChat,
}: AiConversationSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-r bg-muted/20 md:w-72">
      <div className="border-b p-3">
        <Button
          type="button"
          className="w-full justify-start"
          onClick={onNewChat}
          disabled={disabled || isCreating}
        >
          <MessageSquarePlus aria-hidden />
          Nieuwe chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Nog geen opgeslagen gesprekken.
            </p>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left transition-colors",
                    isActive ? "bg-background shadow-sm" : "hover:bg-background/70",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <p className="truncate text-sm font-medium">{conversation.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatConversationDate(conversation.updated_at)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
