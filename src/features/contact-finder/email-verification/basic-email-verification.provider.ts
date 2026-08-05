import "server-only";

import { promises as dns } from "node:dns";

import type {
  EmailVerificationProvider,
  EmailVerificationResult,
  EmailVerificationStatus,
} from "@/features/contact-finder/email-verification/email-verification.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
]);

const ROLE_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "privacy",
  "abuse",
  "support",
  "postmaster",
  "mailer-daemon",
];

const HR_MAILBOX_PREFIXES = [
  "recruitment",
  "recruiter",
  "hr",
  "werkenbij",
  "vacatures",
  "personeel",
  "careers",
  "jobs",
  "info",
];

export class BasicEmailVerificationProvider implements EmailVerificationProvider {
  verifySyntax(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
  }

  async verifyDomain(email: string): Promise<boolean> {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    try {
      await dns.resolve(domain);
      return true;
    } catch {
      return false;
    }
  }

  async verifyMx(email: string): Promise<boolean> {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    try {
      const records = await dns.resolveMx(domain);
      return records.length > 0;
    } catch {
      return false;
    }
  }

  async detectCatchAll(_domain: string): Promise<boolean> {
    return false;
  }

  async verify(email: string, companyDomain?: string | null): Promise<EmailVerificationResult> {
    const normalized = email.trim().toLowerCase();
    const reasons: string[] = [];
    const syntaxValid = this.verifySyntax(normalized);
    if (!syntaxValid) {
      return {
        email: normalized,
        syntaxValid: false,
        domainValid: false,
        mxValid: false,
        disposable: false,
        roleMailbox: false,
        catchAll: false,
        status: "invalid",
        reasons: ["syntax_invalid"],
      };
    }

    const [local, domain] = normalized.split("@");
    const disposable = DISPOSABLE_DOMAINS.has(domain);
    if (disposable) reasons.push("disposable_domain");

    const roleMailbox = ROLE_PREFIXES.some((p) => local.startsWith(p));
    if (roleMailbox) reasons.push("blocked_role_mailbox");

    const personalDomain = PERSONAL_DOMAINS.has(domain);
    if (personalDomain && companyDomain && domain !== companyDomain.toLowerCase()) {
      reasons.push("personal_email_without_company_source");
    }

    const domainValid = await this.verifyDomain(normalized);
    if (!domainValid) reasons.push("domain_not_resolvable");

    const mxValid = domainValid ? await this.verifyMx(normalized) : false;
    if (!mxValid) reasons.push("no_mx_records");

    const catchAll = domainValid ? await this.detectCatchAll(domain) : false;
    const isHrMailbox = HR_MAILBOX_PREFIXES.some((p) => local === p || local.startsWith(`${p}.`));

    let status: EmailVerificationStatus = "unknown";
    if (!syntaxValid || disposable || roleMailbox || !domainValid || !mxValid) {
      status = "invalid";
    } else if (catchAll) {
      status = "catch_all";
    } else if (isHrMailbox || (companyDomain && domain === companyDomain.toLowerCase())) {
      status = "likely";
    } else if (personalDomain) {
      status = "unknown";
    } else {
      status = "likely";
    }

    return {
      email: normalized,
      syntaxValid,
      domainValid,
      mxValid,
      disposable,
      roleMailbox,
      catchAll,
      status,
      reasons,
    };
  }
}

export function createEmailVerificationProvider(): EmailVerificationProvider {
  return new BasicEmailVerificationProvider();
}
