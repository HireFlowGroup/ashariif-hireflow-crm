export * from "@/features/outreach-engine/domain/types";
export { getOutreachSendConfig } from "@/features/outreach-engine/domain/send-rules.config";
export type { EmailProvider } from "@/features/outreach-engine/email/email-provider.types";
export { createEmailProvider } from "@/features/outreach-engine/email/create-email-provider";
export { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
export { OutreachEngine, OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
