import { NextResponse } from "next/server";

import { createEmailProvider } from "@/features/outreach-engine/email/create-email-provider";
import { getOutreachSendConfig } from "@/features/outreach-engine/domain/send-rules.config";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const provider = createEmailProvider();
  const status = await provider.verifyConnection();
  const identities = await provider.listSenderIdentities();
  const config = getOutreachSendConfig();

  return NextResponse.json({
    ...status,
    identities,
    draftOnly: config.draftOnly,
    sendEnabled: config.sendEnabled,
    requireApproval: config.requireApproval,
    testRecipient: config.testRecipient ? "***configured***" : null,
    dailyLimit: config.dailyLimit,
    domainDailyLimit: config.domainDailyLimit,
    cooldownDays: config.companyCooldownDays,
    killSwitch: config.killSwitch,
    senderEmail: config.senderEmail,
  });
}
