export type EmailVerificationStatus = "verified" | "likely" | "catch_all" | "unknown" | "invalid";

export type EmailVerificationResult = {
  email: string;
  syntaxValid: boolean;
  domainValid: boolean;
  mxValid: boolean;
  disposable: boolean;
  roleMailbox: boolean;
  catchAll: boolean;
  status: EmailVerificationStatus;
  reasons: string[];
};

export interface EmailVerificationProvider {
  verifySyntax(email: string): boolean;
  verifyDomain(email: string): Promise<boolean>;
  verifyMx(email: string): Promise<boolean>;
  verifyMailbox?(email: string): Promise<boolean>;
  detectCatchAll(domain: string): Promise<boolean>;
  verify(email: string, companyDomain?: string | null): Promise<EmailVerificationResult>;
}
