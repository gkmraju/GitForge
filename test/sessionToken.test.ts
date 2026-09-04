import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { GitForgeError } from "../packages/core/src/types.js";
import { sealPayload, unsealPayload } from "../packages/auth/src/sessionToken.js";

const key = randomBytes(32).toString("base64");

test("round-trips an encrypted GitForge session", () => {
  const now = Date.now();
  const token = sealPayload({
    kind: "github_session",
    githubToken: "secret-token-value",
    githubLogin: "octocat",
    issuedAt: now,
    expiresAt: now + 60_000,
  }, key);

  assert.equal(token.includes("secret-token-value"), false);
  const payload = unsealPayload(token, key);
  assert.equal(payload.kind, "github_session");
  if (payload.kind === "github_session") {
    assert.equal(payload.githubLogin, "octocat");
    assert.equal(payload.githubToken, "secret-token-value");
  }
});

test("rejects a tampered session token", () => {
  const now = Date.now();
  const token = sealPayload({
    kind: "github_session",
    githubToken: "secret-token-value",
    githubLogin: "octocat",
    issuedAt: now,
    expiresAt: now + 60_000,
  }, key);
  const parts = token.split(".");
  const ciphertext = parts[2]!;
  const index = Math.floor(ciphertext.length / 2);
  parts[2] = ciphertext.slice(0, index) + (ciphertext[index] === "A" ? "B" : "A") + ciphertext.slice(index + 1);
  const tampered = parts.join(".");

  assert.throws(() => unsealPayload(tampered, key), (error: unknown) =>
    error instanceof GitForgeError && error.code === "AUTH_REQUIRED"
  );
});

test("rejects expired sessions", () => {
  const now = Date.now();
  const token = sealPayload({
    kind: "github_session",
    githubToken: "secret-token-value",
    githubLogin: "octocat",
    issuedAt: now - 120_000,
    expiresAt: now - 60_000,
  }, key);

  assert.throws(() => unsealPayload(token, key), (error: unknown) =>
    error instanceof GitForgeError && error.code === "AUTH_REQUIRED"
  );
});
