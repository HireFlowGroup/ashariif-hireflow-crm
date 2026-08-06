import "server-only";

/** Outreach send safety configuration — send disabled by default. */
export function getOutreachSendConfig() {
  const sendEnabled = process.env.OUTREACH_SEND_ENABLED === "true";
  const draftOnly = process.env.OUTREACH_DRAFT_ONLY !== "false";
  const requireApproval = process.env.OUTREACH_REQUIRE_APPROVAL !== "false";

  return {
    sendEnabled,
    draftOnly,
    requireApproval,
    dailyLimit: parseInt(process.env.OUTREACH_DAILY_LIMIT ?? "10", 10),
    domainDailyLimit: parseInt(process.env.OUTREACH_DOMAIN_DAILY_LIMIT ?? "2", 10),
    companyCooldownDays: parseInt(
      process.env.OUTREACH_COOLDOWN_DAYS ?? process.env.OUTREACH_COMPANY_COOLDOWN_DAYS ?? "30",
      10,
    ),
    testRecipient: process.env.OUTREACH_TEST_RECIPIENT?.trim() ?? null,
    killSwitch: process.env.OUTREACH_KILL_SWITCH === "true",
    maxRetries: parseInt(process.env.OUTREACH_MAX_RETRIES ?? "2", 10),
    timezone: process.env.OUTREACH_TIMEZONE ?? "Europe/Amsterdam",
    businessHoursStart: process.env.OUTREACH_BUSINESS_HOURS_START ?? "08:30",
    businessHoursEnd: process.env.OUTREACH_BUSINESS_HOURS_END ?? "17:30",
    senderName: process.env.OUTREACH_SENDER_NAME ?? "HireFlow Group",
    senderEmail: process.env.OUTREACH_SENDER_EMAIL?.trim() ?? null,
    allowedSenderDomains: (process.env.OUTREACH_ALLOWED_SENDER_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  };
}

export type SendRuleViolation = {
  code: string;
  message: string;
};

export function isWithinBusinessHours(now = new Date(), timezone = "Europe/Amsterdam"): boolean {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  const dayMap: Record<string, number> = { zo: 0, ma: 1, di: 2, wo: 3, do: 4, vr: 5, za: 6 };
  const dayNum = dayMap[weekday.slice(0, 2).toLowerCase()] ?? now.getDay();

  if (dayNum === 0 || dayNum === 6) return false;

  const config = getOutreachSendConfig();
  const [startH, startM] = config.businessHoursStart.split(":").map(Number);
  const [endH, endM] = config.businessHoursEnd.split(":").map(Number);
  const currentMinutes = hour * 60 + minute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

export function validateSendWindow(): SendRuleViolation | null {
  if (process.env.OUTREACH_ENFORCE_SEND_WINDOW === "false") {
    return null;
  }
  if (!isWithinBusinessHours()) {
    return {
      code: "outside_business_hours",
      message: "Verzending is alleen toegestaan op werkdagen tussen 08:30 en 17:30 (NL).",
    };
  }
  return null;
}

export function validateKillSwitch(): SendRuleViolation | null {
  if (getOutreachSendConfig().killSwitch) {
    return {
      code: "kill_switch",
      message: "Outreach kill switch is actief — verzending geblokkeerd.",
    };
  }
  return null;
}

export function validateDraftOnlyMode(confirmedByUser: boolean, isTest: boolean): SendRuleViolation | null {
  const config = getOutreachSendConfig();
  if (config.draftOnly && !isTest && !confirmedByUser) {
    return {
      code: "draft_only",
      message: "DRAFT_ONLY modus: expliciete gebruikersbevestiging vereist voor verzending.",
    };
  }
  return null;
}

export function validateSendEnabled(isTest: boolean): SendRuleViolation | null {
  const config = getOutreachSendConfig();
  if (!config.sendEnabled && !isTest) {
    return {
      code: "send_disabled",
      message: "Verzending is uitgeschakeld (OUTREACH_SEND_ENABLED=false).",
    };
  }
  return null;
}

export function validateTestRecipient(
  isTest: boolean,
  testRecipientEmail: string | undefined,
): SendRuleViolation | null {
  const config = getOutreachSendConfig();
  if (!isTest) return null;

  const allowed = config.testRecipient;
  if (!allowed) {
    return {
      code: "test_recipient_not_configured",
      message: "Testmodus vereist OUTREACH_TEST_RECIPIENT.",
    };
  }

  if (!testRecipientEmail || testRecipientEmail.toLowerCase() !== allowed.toLowerCase()) {
    return {
      code: "test_recipient_mismatch",
      message: `Testmail mag alleen naar ${allowed} worden verzonden.`,
    };
  }

  return null;
}

export function validateSenderEmail(fromEmail: string): SendRuleViolation | null {
  const config = getOutreachSendConfig();
  if (!config.senderEmail) {
    return { code: "missing_sender", message: "OUTREACH_SENDER_EMAIL is niet geconfigureerd." };
  }

  if (fromEmail.toLowerCase() !== config.senderEmail.toLowerCase()) {
    return {
      code: "invalid_sender",
      message: `Afzender moet ${config.senderEmail} zijn, niet ${fromEmail}.`,
    };
  }

  if (config.allowedSenderDomains.length > 0) {
    const domain = fromEmail.split("@")[1]?.toLowerCase();
    if (!domain || !config.allowedSenderDomains.includes(domain)) {
      return {
        code: "sender_domain_not_allowed",
        message: `Domein ${domain ?? "?"} is niet toegestaan als zakelijke afzender.`,
      };
    }
  }

  return null;
}

export function computeRetryDelayMs(retryCount: number): number {
  return Math.min(60_000 * 2 ** retryCount, 900_000);
}
