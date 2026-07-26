"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { aiChatSchema, type AiChatFormValues } from "@/lib/validations/ai";

type AiAssistantPanelProps = {
  isConfigured: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AiAssistantPanel({ isConfigured }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AiChatFormValues>({
    resolver: zodResolver(aiChatSchema),
    defaultValues: { message: "" },
  });

  async function onSubmit(values: AiChatFormValues) {
    if (!isConfigured) {
      toast.error("OpenAI is not configured", {
        description: "Set OPENAI_API_KEY in your environment to enable the assistant.",
      });
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: values.message };
    setMessages((current) => [...current, userMessage]);
    reset();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: values.message }),
      });

      const payload = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate a response");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply ?? "" },
      ]);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unexpected error occurred";
      toast.error("Assistant request failed", { description });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="flex min-h-[520px] flex-col">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-muted/20 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask for interview questions, screening criteria, outreach templates, or
                pipeline guidance.
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "mr-auto max-w-[85%] rounded-lg border bg-background px-3 py-2 text-sm"
                  }
                >
                  {message.content}
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Textarea
              placeholder="Ask HireFlow AI..."
              rows={4}
              aria-invalid={Boolean(errors.message)}
              disabled={!isConfigured || isSubmitting}
              {...register("message")}
            />
            {errors.message ? (
              <p className="text-sm text-destructive">{errors.message.message}</p>
            ) : null}
            <Button type="submit" disabled={!isConfigured || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <SendHorizonal />
                  Send
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Integration status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            OpenAI integration is{" "}
            <span className="font-medium text-foreground">
              {isConfigured ? "enabled" : "disabled"}
            </span>
            .
          </p>
          {!isConfigured ? (
            <p>
              Add <code className="rounded bg-muted px-1 py-0.5">OPENAI_API_KEY</code> to
              your server environment to activate chat responses.
            </p>
          ) : (
            <p>Requests are routed through the secured `/api/ai/chat` endpoint.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
