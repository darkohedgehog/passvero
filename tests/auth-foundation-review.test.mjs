import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewPath =
  "docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md";
const proposalPath =
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma";
const migrationContractPath =
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md";

test("authentication review records the exact candidate versions and exclusions", async () => {
  const review = await readFile(reviewPath, "utf8");
  assert.match(review, /better-auth: 1\.7\.1/);
  assert.match(review, /@better-auth\/prisma-adapter: 1\.7\.1/);
  assert.match(review, /Prisma: 7\.8\.0/);
  assert.match(review, /Organization plugin: EXCLUDED/);
  assert.match(review, /Admin plugin: EXCLUDED/);
  assert.match(review, /OAuth plugin: EXCLUDED/);
  assert.match(review, /Magic-link plugin: EXCLUDED/);
  assert.match(review, /2FA plugin: EXCLUDED/);
  assert.match(review, /Passkey plugin: EXCLUDED/);
  assert.match(review, /Redis: EXCLUDED/);
  assert.match(review, /Public signup: EXCLUDED/);
  assert.match(review, /Automatic linking: EXCLUDED/);
  assert.match(review, /Database connection performed: NO/);
});

test("raw candidate contains the four isolated provider models", async () => {
  const schema = await readFile(
    "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma",
    "utf8",
  );
  for (const model of [
    "AuthProviderUser",
    "AuthProviderSession",
    "AuthProviderAccount",
    "AuthProviderVerification",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.doesNotMatch(schema, /model Organization\s*\{/);
  assert.doesNotMatch(schema, /model Membership\s*\{/);
});

test("proposal keeps provider identity separate and binds by stable subject", async () => {
  const schema = await readFile(proposalPath, "utf8");
  const identity = schema.match(/model AuthIdentity\s*\{[\s\S]*?^\}/m)?.[0];
  assert.ok(identity);
  assert.match(identity, /provider\s+String/);
  assert.match(identity, /providerSubject\s+String/);
  assert.match(identity, /userId\s+String\s+@db\.Uuid/);
  assert.match(identity, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(identity, /user\s+User\s+@relation/);
  assert.doesNotMatch(identity, /email/);
});

test("proposal covers server session, activation, and progressive abuse state", async () => {
  const schema = await readFile(proposalPath, "utf8");
  assert.match(schema, /authenticatedAt\s+DateTime/);
  assert.match(schema, /selectedOrganizationId\s+String\?\s+@db\.Uuid/);
  const session = schema.match(/model AuthProviderSession\s*\{[\s\S]*?^\}/m)?.[0];
  assert.ok(session);
  assert.doesNotMatch(session, /\b(role|roles|permission|permissions)\b/i);
  assert.match(schema, /model AccountActivation\s*\{/);
  assert.match(schema, /tokenDigest\s+String\s+@unique/);
  assert.match(schema, /model AuthCredentialToken\s*\{/);
  const abuse = schema.match(/model AuthAbuseBucket\s*\{[\s\S]*?^\}/m)?.[0];
  assert.ok(abuse);
  assert.match(abuse, /keyDigest\s+String\s+@unique/);
  assert.doesNotMatch(abuse, /email\s+String/);
  assert.doesNotMatch(abuse, /ipAddress\s+String/);
});

test("migration contract fixes token lifecycle, abuse retention, and deployment gates", async () => {
  const contract = await readFile(migrationContractPath, "utf8");
  for (const dimension of [
    "TRUSTED_NETWORK",
    "ACCOUNT_IDENTIFIER",
    "ACCOUNT_AND_TRUSTED_NETWORK",
    "GLOBAL_ENDPOINT",
  ]) {
    assert.match(contract, new RegExp(`\\b${dimension}\\b`));
  }
  assert.match(contract, /predecessor invalidation/i);
  assert.match(contract, /atomic conditional update/i);
  assert.match(contract, /partial unique index/i);
  assert.match(contract, /30 days/);
  assert.match(contract, /Plaintext email, IP address, network, user agent, password, and token columns: FORBIDDEN/);
  for (const rule of [
    "Better Auth CLI migration execution: FORBIDDEN",
    "Prisma db push: FORBIDDEN",
    "Direct SQL execution during review: FORBIDDEN",
    "Canonical migration directory mutation during review: FORBIDDEN",
    "Future migration requires schema tests before deployment: YES",
    "Future migration deployment requires separate operator authorization: YES",
    "Existing 16 migration sources must retain approved hashes: YES",
  ]) {
    assert.match(contract, new RegExp(rule));
  }
});
