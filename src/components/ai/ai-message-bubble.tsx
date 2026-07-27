import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiChatRole } from "@/components/ai/types";

type AiMessageBubbleProps = {
  role: AiChatRole;
  content: string;
  isStreaming?: boolean;
};

export function AiMessageBubble({
  role,
  content,
  isStreaming = false,
}: AiMessageBubbleProps) {
  const isUser = role === "user";
  const showTypingIndicator = !isUser && isStreaming && content.length === 0;

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
        isUser
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto border bg-background",
      )}
    >
      {showTypingIndicator ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Bezig met antwoorden…</span>
        </div>
      ) : (
        <p className="whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}
