export type { AiEmailWriterDraft, AiEmailWriterStyle } from "@/features/ai-email-writer/domain/ai-email-writer.types";
export {
  generateAiEmailDraft,
  rewriteAiEmailDraft,
  MAX_EMAIL_WORDS,
} from "@/features/ai-email-writer/services/ai-email-writer.service";
