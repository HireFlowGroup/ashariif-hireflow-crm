import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "hireflow-provider-vault-v1";

export class ProviderVaultEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderVaultEncryptionError";
  }
}

function deriveKey(masterKey: string): Buffer {
  const trimmed = masterKey.trim();

  if (!trimmed) {
    throw new ProviderVaultEncryptionError(
      "PROVIDER_SECRETS_ENCRYPTION_KEY ontbreekt. Stel een 32-byte sleutel in voor productie.",
    );
  }

  return scryptSync(trimmed, SALT, 32);
}

export function getEncryptionMasterKey(): string | null {
  return process.env.PROVIDER_SECRETS_ENCRYPTION_KEY?.trim() ?? null;
}

export function requireEncryptionMasterKey(): string {
  const key = getEncryptionMasterKey();

  if (!key) {
    throw new ProviderVaultEncryptionError(
      "PROVIDER_SECRETS_ENCRYPTION_KEY ontbreekt. Genereer met: openssl rand -base64 32",
    );
  }

  return key;
}

export function encryptSecrets(payload: Record<string, string>): string {
  const masterKey = requireEncryptionMasterKey();
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecrets(ciphertext: string): Record<string, string> {
  const masterKey = requireEncryptionMasterKey();
  const key = deriveKey(masterKey);
  const buffer = Buffer.from(ciphertext, "base64");

  if (buffer.length < IV_LENGTH + 16 + 1) {
    throw new ProviderVaultEncryptionError("Ongeldige encrypted payload.");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(decrypted) as Record<string, string>;

  if (!parsed || typeof parsed !== "object") {
    throw new ProviderVaultEncryptionError("Ontsleutelde payload is ongeldig.");
  }

  return parsed;
}

export function fingerprintSecrets(payload: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= 4) {
    return "••••";
  }

  return `••••${trimmed.slice(-4)}`;
}

export function buildMaskedPreview(secrets: Record<string, string>): string {
  const primary = secrets.apiKey ?? Object.values(secrets)[0];

  if (!primary) return "••••";

  return maskSecret(primary);
}
