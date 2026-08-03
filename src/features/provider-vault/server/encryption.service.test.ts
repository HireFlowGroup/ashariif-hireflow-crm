import { afterEach, describe, expect, it } from "vitest";

import {
  buildMaskedPreview,
  decryptSecrets,
  encryptSecrets,
  fingerprintSecrets,
} from "@/features/provider-vault/server/encryption.service";

describe("provider vault encryption", () => {
  const originalKey = process.env.PROVIDER_SECRETS_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.PROVIDER_SECRETS_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts and decrypts secrets roundtrip", () => {
    process.env.PROVIDER_SECRETS_ENCRYPTION_KEY = "test-master-key-for-provider-vault-32b";
    const payload = { apiKey: "sk-test-secret-key", cx: "search-engine-id" };
    const encrypted = encryptSecrets(payload);
    const decrypted = decryptSecrets(encrypted);

    expect(decrypted).toEqual(payload);
    expect(encrypted).not.toContain("sk-test");
  });

  it("builds stable fingerprint and masked preview", () => {
    process.env.PROVIDER_SECRETS_ENCRYPTION_KEY = "test-master-key-for-provider-vault-32b";
    const secrets = { apiKey: "BSA-1234567890" };
    const fp1 = fingerprintSecrets(secrets);
    const fp2 = fingerprintSecrets(secrets);

    expect(fp1).toBe(fp2);
    expect(buildMaskedPreview(secrets)).toBe("••••7890");
  });
});
