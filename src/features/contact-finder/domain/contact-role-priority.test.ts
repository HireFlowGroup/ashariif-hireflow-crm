import { describe, expect, it } from "vitest";

import {
  MAILBOX_FALLBACK_PREFIXES,
  matchContactRole,
  pickBestMailboxEmail,
} from "@/features/contact-finder/domain/contact-role-priority";

describe("matchContactRole", () => {
  it("prioritizes HR Manager over Recruiter", () => {
    expect(matchContactRole("HR Manager")?.label).toBe("HR Manager");
    expect(matchContactRole("Corporate Recruiter")?.label).toBe("Recruiter");
    expect(matchContactRole("Recruitment Manager")?.label).toBe("Teamlead Recruitment");
  });
});

describe("pickBestMailboxEmail", () => {
  it("prefers recruitment@ over hr@ and info@", () => {
    expect(
      pickBestMailboxEmail(["info@acme.nl", "hr@acme.nl", "recruitment@acme.nl"]),
    ).toBe("recruitment@acme.nl");
  });

  it("follows fallback order recruitment hr jobs info", () => {
    expect(MAILBOX_FALLBACK_PREFIXES).toEqual(["recruitment", "hr", "jobs", "info"]);
  });
});
