import "server-only";

import type { EmailProvider } from "@/features/outreach-engine/email/email-provider.types";
import { createGmailProviderFromEnv } from "@/features/outreach-engine/email/gmail-email-provider";
import { MockEmailProvider } from "@/features/outreach-engine/email/mock-email-provider";
import { createSmtpProviderFromEnv } from "@/features/outreach-engine/email/smtp-email-provider";

/** Priority: Gmail OAuth → Strato SMTP → Mock (dev/test). */
export function createEmailProvider(): EmailProvider {
  if (process.env.NODE_ENV === "test") {
    return new MockEmailProvider();
  }

  const gmail = createGmailProviderFromEnv();
  if (gmail) return gmail;

  const smtp = createSmtpProviderFromEnv();
  if (smtp) return smtp;

  return new MockEmailProvider();
}

export function createEmailProviderForTests(options?: {
  shouldFail?: boolean;
}): MockEmailProvider {
  return new MockEmailProvider(options);
}
