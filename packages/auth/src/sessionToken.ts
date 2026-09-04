import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GitForgeError } from "../../core/src/types.js";

const VERSION = "gf1";
const AAD = Buffer.from("gitforge-session-v1", "utf8");

export type GitForgeSession = {
  kind: "github_session";
  githubToken: string;
  githubLogin: string;
  issuedAt: number;
  expiresAt: number;
};

export type GitHubDeviceRequest = {
  kind: "github_device";
  deviceCode: string;
  issuedAt: number;
  expiresAt: number;
  intervalSeconds: number;
};

type SealedPayload = GitForgeSession | GitHubDeviceRequest;

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new GitForgeError("AUTH_REQUIRED", "GITFORGE_SESSION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function sealPayload(payload: SealedPayload, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function unsealPayload(token: string, keyBase64: string): SealedPayload {
  const [version, ivText, ciphertextText, tagText] = token.split(".");
  if (version !== VERSION || !ivText || !ciphertextText || !tagText) {
    throw new GitForgeError("AUTH_REQUIRED", "Invalid GitForge session token.");
  }
  try {
    const key = decodeKey(keyBase64);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as SealedPayload;
    if (!payload.expiresAt || Date.now() >= payload.expiresAt) {
      throw new GitForgeError("AUTH_REQUIRED", "GitForge session has expired.");
    }
    return payload;
  } catch (error) {
    if (error instanceof GitForgeError) throw error;
    throw new GitForgeError("AUTH_REQUIRED", "Invalid GitForge session token.");
  }
}
