import { beforeEach, describe, expect, it, vi } from "vitest";

import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import type {
  OutreachEvent,
  OutreachMessage,
  OutreachMessageStatus,
} from "@/features/outreach-engine/domain/types";
import { MockEmailProvider } from "@/features/outreach-engine/email/mock-email-provider";
import type { OutreachEngineRepository } from "@/features/outreach-engine/repositories/outreach-engine.repository";
import { OutreachEngine, OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";

const ORG = "org-1";
const USER = "user-1";
const COMPANY_ID = "company-1";

function mockCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: toCompanyId(COMPANY_ID),
    organizationId: ORG,
    ownerId: null,
    name: "Acme BV",
    website: "https://acme.nl",
    domain: "acme.nl",
    linkedinUrl: null,
    email: null,
    phone: null,
    sector: "Logistiek",
    city: "Rotterdam",
    region: null,
    province: null,
    country: "NL",
    employeeCount: 80,
    employeeCountMin: null,
    employeeCountMax: null,
    employeeCountLabel: null,
    priority: null,
    leadScore: 75,
    leadPriority: "B",
    scoreReason: null,
    scoreBreakdown: null,
    vacancyCount: 1,
    hiringSignals: [{ type: "vacancy", description: "1 open vacature", source: "web", confidence: 0.8 }],
    careersUrl: null,
    vacancyPageUrl: null,
    generalEmail: null,
    hrEmail: "hr@acme.nl",
    kvkNumber: null,
    aiSummary: null,
    source: null,
    sourceUrl: null,
    confidence: null,
    companyType: null,
    companyConfidence: null,
    discoveryReason: null,
    discoveryProvider: null,
    lastVerifiedAt: null,
    outreachStatus: "none",
    status: "active",
    notes: null,
    outreachOptOut: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function createMessage(overrides: Partial<OutreachMessage> = {}): OutreachMessage {
  return {
    id: "msg-1",
    organizationId: ORG,
    campaignId: null,
    companyId: COMPANY_ID,
    contactId: null,
    recipientName: "Jan Jansen",
    recipientEmail: "jan@acme.nl",
    subject: "Kennismaking",
    bodyText: "Hallo",
    bodyHtml: null,
    status: "pending_approval",
    personalizationData: {
      companyName: "Acme BV",
      sector: "Logistiek",
      city: "Rotterdam",
      contactName: "Jan Jansen",
      vacancyCount: 1,
      hiringSignal: "1 open vacature",
      fieldsUsed: ["companyName"],
      warnings: [],
      generatedAt: "2026-08-01T00:00:00Z",
    },
    provider: "mock",
    providerMessageId: null,
    errorMessage: null,
    idempotencyKey: "idem-1",
    retryCount: 0,
    approvedBy: null,
    approvedAt: null,
    sentAt: null,
    createdBy: USER,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function createMockRepository(initial: OutreachMessage[] = []): OutreachEngineRepository {
  const messages = new Map(initial.map((m) => [m.id, { ...m }]));
  const events: OutreachEvent[] = [];

  return {
    getDefaultCampaign: vi.fn().mockResolvedValue(null),
    createCampaign: vi.fn(),
    createMessage: vi.fn(async (_org, _user, input) => {
      const msg = createMessage({
        id: `msg-${messages.size + 1}`,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        subject: input.subject,
        bodyText: input.bodyText,
        status: input.status,
        personalizationData: input.personalizationData as OutreachMessage["personalizationData"],
        idempotencyKey: input.idempotencyKey,
        provider: input.provider,
      });
      messages.set(msg.id, msg);
      return msg;
    }),
    updateMessage: vi.fn(async (_org, id, updates) => {
      const existing = messages.get(id);
      if (!existing) throw new Error("not found");
      const updated = { ...existing, ...updates };
      messages.set(id, updated);
      return updated;
    }),
    getMessage: vi.fn(async (_org, id) => messages.get(id) ?? null),
    listMessages: vi.fn(async () => [...messages.values()]),
    logEvent: vi.fn(async (_org, messageId, eventType, metadata = {}) => {
      const event: OutreachEvent = {
        id: `evt-${events.length + 1}`,
        organizationId: ORG,
        outreachMessageId: messageId,
        eventType,
        metadata,
        createdAt: new Date().toISOString(),
      };
      events.push(event);
      return event;
    }),
    getSuppressedEmails: vi.fn().mockResolvedValue(new Set<string>()),
    getBouncedEmails: vi.fn().mockResolvedValue(new Set<string>()),
    getRecentlyContactedCompanyIds: vi.fn().mockResolvedValue(new Set<string>()),
    countSentToday: vi.fn(async () => 0),
    getActiveRecipientEmails: vi.fn().mockResolvedValue(new Set<string>()),
    addSuppression: vi.fn(async () => undefined),
  } as OutreachEngineRepository;
}

function createContactsClient(contacts: Array<Record<string, unknown>> = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  };

  return {
    from: vi.fn(() => ({
      ...chain,
      then(onFulfilled: (value: { data: typeof contacts }) => unknown) {
        return Promise.resolve(onFulfilled({ data: contacts }));
      },
    })),
  };
}

describe("OutreachEngine", () => {
  beforeEach(() => {
    process.env.OUTREACH_DRAFT_ONLY = "true";
    process.env.OUTREACH_SENDER_EMAIL = "outreach@hireflowgroup.nl";
    process.env.OUTREACH_DAILY_LIMIT = "10";
    process.env.OUTREACH_KILL_SWITCH = "false";
    process.env.OUTREACH_ENFORCE_SEND_WINDOW = "false";
  });

  it("blocks prospect send without approval", async () => {
    const repo = createMockRepository([createMessage({ status: "pending_approval" })]);
    const provider = new MockEmailProvider();
    const companiesService = {
      getCompany: vi.fn().mockResolvedValue(mockCompany()),
    } as unknown as CompaniesService;

    const engine = new OutreachEngine(
      repo,
      companiesService,
      provider,
      createContactsClient() as never,
    );

    await expect(
      engine.sendMessage(
        { organizationId: ORG, userId: USER },
        { messageId: "msg-1", confirmedByUser: true, isTest: false },
      ),
    ).rejects.toMatchObject({ code: "not_approved" });
  });

  it("sends test mail to own address bypassing business rules", async () => {
    const repo = createMockRepository([createMessage({ status: "draft" })]);
    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;

    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    const result = await engine.sendMessage(
      { organizationId: ORG, userId: USER },
      {
        messageId: "msg-1",
        confirmedByUser: true,
        isTest: true,
        testRecipientEmail: "test@hireflowgroup.nl",
      },
    );

    expect(result.status).toBe("sent");
    expect(provider.getSentMessages()).toHaveLength(1);
    expect(provider.getSentMessages()[0]?.to).toBe("test@hireflowgroup.nl");
  });

  it("uses configured business sender address", async () => {
    const repo = createMockRepository([createMessage({ status: "approved" })]);
    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;

    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    await engine.sendMessage(
      { organizationId: ORG, userId: USER },
      { messageId: "msg-1", confirmedByUser: true, isTest: true, testRecipientEmail: "me@hireflowgroup.nl" },
    );

    expect(provider.getSentMessages()[0]?.fromEmail).toBe("outreach@hireflowgroup.nl");
  });

  it("marks failed on provider error and allows retry", async () => {
    const repo = createMockRepository([createMessage({ status: "approved", retryCount: 0 })]);
    const provider = new MockEmailProvider({ shouldFail: true });
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;

    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    await expect(
      engine.sendMessage(
        { organizationId: ORG, userId: USER },
        { messageId: "msg-1", confirmedByUser: true, isTest: true, testRecipientEmail: "me@hireflowgroup.nl" },
      ),
    ).rejects.toBeInstanceOf(OutreachEngineError);

    const updated = await repo.getMessage(ORG, "msg-1");
    expect(updated?.status).toBe("approved");
    expect(updated?.retryCount).toBe(1);
  });

  it("never resends after status sent", async () => {
    const repo = createMockRepository([createMessage({ status: "sent" })]);
    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;

    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    await expect(
      engine.sendMessage(
        { organizationId: ORG, userId: USER },
        { messageId: "msg-1", confirmedByUser: true, isTest: true, testRecipientEmail: "me@hireflowgroup.nl" },
      ),
    ).rejects.toMatchObject({ code: "already_sent" });
  });

  it("enforces daily limit for non-test sends", async () => {
    const repo = createMockRepository([createMessage({ status: "approved" })]);
    vi.mocked(repo.countSentToday).mockResolvedValue(10);

    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;
    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    await expect(
      engine.sendMessage(
        { organizationId: ORG, userId: USER },
        { messageId: "msg-1", confirmedByUser: true },
      ),
    ).rejects.toMatchObject({ code: "daily_limit" });
  });

  it("blocks send when kill switch active", async () => {
    process.env.OUTREACH_KILL_SWITCH = "true";
    const repo = createMockRepository([createMessage({ status: "approved" })]);
    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;
    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    await expect(
      engine.sendMessage(
        { organizationId: ORG, userId: USER },
        { messageId: "msg-1", confirmedByUser: true, isTest: true, testRecipientEmail: "me@hireflowgroup.nl" },
      ),
    ).rejects.toMatchObject({ code: "kill_switch" });
  });

  it("creates blocked record when no recipient", async () => {
    const repo = createMockRepository();
    const provider = new MockEmailProvider();
    const companiesService = {
      getCompany: vi.fn().mockResolvedValue(mockCompany({ hrEmail: null, domain: null })),
    } as unknown as CompaniesService;

    const contactsClient = createContactsClient([]);

    const engine = new OutreachEngine(repo, companiesService, provider, contactsClient as never);

    await expect(
      engine.createDraft({ organizationId: ORG, userId: USER }, { companyId: COMPANY_ID }),
    ).rejects.toMatchObject({ code: "missing_recipient" });
  });

  it("requires explicit confirmation in DRAFT_ONLY for prospect send", async () => {
    const repo = createMockRepository([createMessage({ status: "approved" })]);
    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;
    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    await expect(
      engine.sendMessage(
        { organizationId: ORG, userId: USER },
        { messageId: "msg-1", confirmedByUser: false },
      ),
    ).rejects.toMatchObject({ code: "draft_only" });
  });

  it("approves draft and logs event", async () => {
    const repo = createMockRepository([createMessage({ status: "pending_approval" })]);
    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn() } as unknown as CompaniesService;
    const engine = new OutreachEngine(repo, companiesService, provider, createContactsClient() as never);

    const approved = await engine.approveMessage({ organizationId: ORG, userId: USER }, "msg-1");
    expect(approved.status).toBe("approved");
    expect(repo.logEvent).toHaveBeenCalledWith(ORG, "msg-1", "approved", expect.any(Object));
  });

  it("blocks duplicate recipient on draft creation", async () => {
    const repo = createMockRepository();
    repo.getActiveRecipientEmails = vi.fn().mockResolvedValue(new Set(["jan.jansen@acme.nl"]));

    const provider = new MockEmailProvider();
    const companiesService = { getCompany: vi.fn().mockResolvedValue(mockCompany()) } as unknown as CompaniesService;

    const contactsClient = createContactsClient([
      {
        id: "c1",
        first_name: "Jan",
        last_name: "Jansen",
        job_title: "HR Manager",
        email: "jan.jansen@acme.nl",
        confidence: 0.9,
        outreach_opt_out: false,
      },
    ]);

    const engine = new OutreachEngine(repo, companiesService, provider, contactsClient as never);

    await expect(
      engine.createDraft({ organizationId: ORG, userId: USER }, { companyId: COMPANY_ID }),
    ).rejects.toMatchObject({ code: "duplicate" });
  });
});
