import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createTestPrismaClient, requireSafeTestDatabaseConfig } from "../helpers/test-database";
import { PrismaAccessRequests } from "../../src/infrastructure/persistence/prisma/prisma-access-requests";
import type { AuthEmailMessage, AuthEmailSender } from "../../src/application/auth/auth-email";
import { PrismaAuthAbuseRepository } from "../../src/infrastructure/auth/prisma-auth-abuse-repository";
import { authAbusePolicyByEndpoint, evaluateAuthAbuseDecision } from "../../src/application/auth/auth-abuse-policy";
const prisma = createTestPrismaClient(requireSafeTestDatabaseConfig(process.env));
const repository = new PrismaAccessRequests(prisma, async email => (await prisma.authProviderUser.findUnique({ where: { email }, select: { id: true } })) !== null);
const env = { BETTER_AUTH_URL: "https://staging.passvero.eu", BETTER_AUTH_SECRET: "proof-secret-".repeat(6), AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET: Buffer.alloc(32, 1).toString("base64url"), AUTH_ACTIVATION_EMAIL_HMAC_SECRET: Buffer.alloc(32, 2).toString("base64url") };
let sent: AuthEmailMessage[] = [];
const sender: AuthEmailSender = { async send(message) { sent.push(message); return { status: "SENT" }; } };
async function request() {
  const input = { contactName: "Synthetic contact", email: `${randomUUID()}@example.test`, organizationDisplayName: "Synthetic organization", locale: "hr" };
  await repository.submit(input);
  const row = await prisma.accessRequest.findUniqueOrThrow({ where: { email: input.email } });
  return { ...input, id: row.id };
}
test.after(async () => { await prisma.$disconnect(); });
test("duplicate submission preserves original statement without business rows", async () => {
  const input = await request(); const { id, ...payload } = input;
  await Promise.all(Array.from({ length: 8 }, () => repository.submit({ ...payload, organizationDisplayName: "Changed claim" })));
  assert.equal(await prisma.accessRequest.count({ where: { email: input.email } }), 1);
  assert.equal((await repository.review(id))?.organizationDisplayName, input.organizationDisplayName);
  assert.equal(await prisma.user.count({ where: { email: input.email } }), 0);
});
test("concurrent approval creates one aggregate and one message, no secrets in results/audit", async () => {
  sent = []; const input = await request();
  const results = await Promise.all(Array.from({ length: 6 }, () => repository.approve(input.id, "proof", env, sender)));
  assert.equal(sent.length, 1);
  assert.equal(results.filter(r => r.status === "APPROVED").length, 1);
  const row = await prisma.accessRequest.findUniqueOrThrow({ where: { id: input.id } });
  assert.equal(row.deliveryStatus, "SENT");
  assert.equal(await prisma.membership.count({ where: { userId: row.userId! } }), 1);
  assert.equal(await prisma.accountActivationIntent.count({ where: { userId: row.userId! } }), 1);
  assert.equal(await prisma.authIdentity.count({ where: { userId: row.userId! } }), 0);
  assert.equal(await prisma.product.count({ where: { organizationId: row.organizationId! } }), 0);
  const membership = await prisma.membership.findFirstOrThrow({ where: { userId: row.userId! } });
  assert.equal(membership.role, "ADMIN"); assert.equal(membership.organizationId, row.organizationId);
  const logs = await prisma.authAuditEvent.findMany({ where: { correlationId: input.id } });
  assert.doesNotMatch(JSON.stringify({ results, logs }), /capability|tokenDigest|example\.test|Synthetic contact/);
  await assert.rejects(repository.reject(input.id, "proof"));
});
test("rejection is idempotent, races have one decision and no provisioning on rejection", async () => {
  sent = []; const rejected = await request();
  await repository.reject(rejected.id, "proof"); await repository.reject(rejected.id, "proof");
  await assert.rejects(repository.approve(rejected.id, "proof", env, sender));
  assert.equal(await prisma.user.count({ where: { email: rejected.email } }), 0);
  const input = await request();
  await Promise.allSettled([repository.reject(input.id, "proof"), repository.approve(input.id, "proof", env, sender)]);
  const row = await repository.review(input.id);
  assert.ok(row?.status === "APPROVED" || row?.status === "REJECTED");
  assert.equal(await prisma.user.count({ where: { email: input.email } }), row.status === "APPROVED" ? 1 : 0);
});
test("existing business and provider email never links; partial provisioning rolls back", async () => {
  const existing = await request();
  await prisma.user.create({ data: { email: existing.email } });
  await assert.rejects(repository.approve(existing.id, "proof", env, sender));
  assert.equal((await repository.review(existing.id))?.status, "PENDING");
  const provider = await request();
  await prisma.authProviderUser.create({ data: { id: randomUUID(), email: provider.email, name: "Synthetic" } });
  await assert.rejects(repository.approve(provider.id, "proof", env, sender));
  assert.equal(await prisma.user.count({ where: { email: provider.email } }), 0);
  const failed = await request();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION access_proof_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'ACCESS_REQUEST_APPROVED' THEN RAISE EXCEPTION 'synthetic'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER access_proof_failure BEFORE INSERT ON "AuthAuditEvent" FOR EACH ROW EXECUTE FUNCTION access_proof_fail()`);
  try { await assert.rejects(repository.approve(failed.id, "proof", env, sender)); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER access_proof_failure ON "AuthAuditEvent"'); await prisma.$executeRawUnsafe('DROP FUNCTION access_proof_fail()'); }
  assert.equal(await prisma.user.count({ where: { email: failed.email } }), 0);
  assert.equal((await repository.review(failed.id))?.status, "PENDING");
  await repository.approve(failed.id, "proof", env, sender);
});
test("uncertain email does not repeat provisioning or delivery on approve", async () => {
  const input = await request(); let attempts = 0;
  const failedSender: AuthEmailSender = { async send() { attempts++; throw new Error("synthetic provider private error"); } };
  const result = await repository.approve(input.id, "proof", env, failedSender);
  assert.equal(result.deliveryStatus, "DELIVERY_UNKNOWN");
  await repository.approve(input.id, "proof", env, failedSender);
  assert.equal(attempts, 1);
  const row = await repository.review(input.id);
  assert.equal(await prisma.accountActivationIntent.count({ where: { userId: row!.userId! } }), 1);
});
test("request access abuse counts successful repeated attempts", async () => {
  const abuse = new PrismaAuthAbuseRepository(prisma);
  const policy = authAbusePolicyByEndpoint.REQUEST_ACCESS;
  const keys = [{ endpoint: "REQUEST_ACCESS", dimension: "ACCOUNT_IDENTIFIER", keyDigest: Buffer.alloc(32, 9).toString("base64url") }] as const;
  const now = new Date();
  const first = await abuse.recordPreAttempt({ keys, policy, now });
  assert.equal(evaluateAuthAbuseDecision(first, now, "REQUEST_ACCESS").status, "ALLOW");
  for (let i = 0; i < 4; i++) await abuse.recordPreAttempt({ keys, policy, now });
  const last = await abuse.recordPreAttempt({ keys, policy, now });
  assert.equal(evaluateAuthAbuseDecision(last, now, "REQUEST_ACCESS").status, "BLOCK");
});
test("explicit delivery recovery reuses aggregate, invalidates old capability and stops after two retries", async () => {
  const input = await request();
  const failedSender: AuthEmailSender = { async send() { throw new Error("synthetic"); } };
  await repository.approve(input.id, "proof", env, failedSender);
  const before = await prisma.accessRequest.findUniqueOrThrow({ where: { id: input.id } });
  const old = await prisma.accountActivationIntent.findUniqueOrThrow({ where: { id: before.activationId! } });
  await repository.retryDelivery(input.id, "proof", env, failedSender);
  const replaced = await prisma.accountActivationIntent.findUniqueOrThrow({ where: { id: before.activationId! } });
  assert.notEqual(old.tokenDigest, replaced.tokenDigest);
  await repository.retryDelivery(input.id, "proof", env, failedSender);
  await assert.rejects(repository.retryDelivery(input.id, "proof", env, sender));
  assert.equal(await prisma.accountActivationIntent.count({ where: { userId: before.userId! } }), 1);
  assert.equal(await prisma.membership.count({ where: { userId: before.userId! } }), 1);
});
test("approved request follows existing activation, verified binding and server organization resolver", async () => {
  const { createControlledActivationService } = await import("../../src/application/auth/controlled-activation");
  const { createVerifiedActivationCompletionService } = await import("../../src/application/auth/complete-verified-activation");
  const { PrismaControlledActivationRepository, PrismaAuthTransactionRunner, PrismaVerifiedActivationPersistence } = await import("../../src/infrastructure/auth/prisma-controlled-activation");
  const { createActivationDigesters } = await import("../../src/infrastructure/auth/activation-digests");
  const { createCurrentUserResolver } = await import("../../src/application/auth/resolve-current-user");
  const { PrismaAuthIdentityReader } = await import("../../src/infrastructure/auth/prisma-auth-identity-reader");
  const { createAuthenticatedUserContextResolver } = await import("../../src/application/context/resolve-authenticated-user-context");
  const { PrismaOrganizationContextRepository } = await import("../../src/infrastructure/context/prisma-organization-context-repository");
  sent = []; const input = await request();
  await repository.approve(input.id, "proof", env, sender);
  const mail = sent[0];
  if (mail.type !== "CONTROLLED_ACTIVATION") throw new Error("Expected activation message");
  const capability = new URLSearchParams(new URL(mail.activationUrl).hash.slice(1)).get("capability")!;
  const digesters = createActivationDigesters({ capabilityKey: Buffer.alloc(32, 1), emailKey: Buffer.alloc(32, 2) });
  const subject = randomUUID(); let credentials = 0;
  const activate = createControlledActivationService({ ...digesters, activationRepository: new PrismaControlledActivationRepository(prisma), claimIdGenerator: { generate: randomUUID }, now: () => new Date(), provider: {
    async createCredential() { credentials++; return { providerSubject: subject, normalizedEmail: input.email, emailVerified: false }; },
    async requestEmailVerification() {},
  } });
  const identity = { provider: "BETTER_AUTH" as const, providerSubject: subject, providerSessionId: randomUUID(), authenticatedAt: new Date() };
  const context = createAuthenticatedUserContextResolver({ resolveCurrentUser: createCurrentUserResolver({ identityReader: new PrismaAuthIdentityReader(prisma), now: () => new Date() }), repository: new PrismaOrganizationContextRepository(prisma), correlationId: randomUUID });
  assert.equal((await context(identity)).status, "DENIED");
  const password = `Proof!${randomUUID()}aB9`;
  assert.equal((await activate({ capability, password })).status, "VERIFICATION_PENDING");
  assert.equal((await context(identity)).status, "DENIED");
  await assert.rejects(repository.retryDelivery(input.id, "proof", env, sender));
  const complete = createVerifiedActivationCompletionService({ transactionRunner: new PrismaAuthTransactionRunner(prisma), persistence: new PrismaVerifiedActivationPersistence(), intendedEmailDigester: digesters.intendedEmailDigester, now: () => new Date() });
  const verified = { providerSubject: subject, email: input.email };
  assert.equal((await complete(verified, randomUUID())).status, "BOUND");
  assert.equal((await complete(verified, randomUUID())).status, "ALREADY_BOUND");
  assert.equal((await activate({ capability, password })).status, "ALREADY_BOUND");
  assert.equal(credentials, 1);
  const resolved = await context(identity);
  assert.equal(resolved.status, "RESOLVED");
  if (resolved.status === "RESOLVED") {
    assert.equal(resolved.context.organizationId, (await repository.review(input.id))?.organizationId);
    assert.equal(resolved.context.membershipRole, "ADMIN");
    assert.ok(resolved.context.permissions.includes("PRODUCT_CREATE"));
  }
  sent = [];
});
test("post-send audit failure preserves uncertain state and replay never sends again", async () => {
  const input = await request(); let sends = 0;
  await prisma.$executeRawUnsafe(`CREATE FUNCTION access_delivery_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'ACCESS_ACTIVATION_SENT' THEN RAISE EXCEPTION 'synthetic'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER access_delivery_failure BEFORE INSERT ON "AuthAuditEvent" FOR EACH ROW EXECUTE FUNCTION access_delivery_fail()`);
  try {
    const result = await repository.approve(input.id, "proof", env, { async send() { sends++; return { status: "SENT" }; } });
    assert.equal(result.deliveryStatus, "DELIVERY_RECONCILIATION_REQUIRED");
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER access_delivery_failure ON "AuthAuditEvent"');
    await prisma.$executeRawUnsafe('DROP FUNCTION access_delivery_fail()');
  }
  assert.equal((await repository.review(input.id))?.deliveryStatus, "DELIVERY_IN_PROGRESS");
  await repository.approve(input.id, "proof", env, { async send() { sends++; return { status: "SENT" }; } });
  await assert.rejects(repository.retryDelivery(input.id, "proof", env, sender));
  assert.equal(sends, 1);
});

test("approval inserts profile fields with staging privileges and no User or Organization UPDATE", async () => {
  const input = await request();
  await prisma.$executeRawUnsafe('CREATE ROLE access_approval_insert_proof NOLOGIN');
  try {
    await prisma.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO access_approval_insert_proof');
    await prisma.$executeRawUnsafe('GRANT SELECT, INSERT ON "AccessRequest", "Organization", "User", "Membership", "AccountActivationIntent", "AuditLog", "AuthAuditEvent" TO access_approval_insert_proof');
    await prisma.$executeRawUnsafe('GRANT UPDATE ON "AccessRequest", "AccountActivationIntent" TO access_approval_insert_proof');
    const restricted = {
      $transaction: (work: (tx: import("../../src/generated/prisma/client").Prisma.TransactionClient) => Promise<unknown>) => prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE access_approval_insert_proof');
        return work(tx);
      }),
    } as unknown as typeof prisma;
    const result = await new PrismaAccessRequests(restricted, async () => false).approve(input.id, "proof", env, sender);
    assert.deepEqual(result, { status: "APPROVED", deliveryStatus: "SENT" });
    const row = await prisma.accessRequest.findUniqueOrThrow({ where: { id: input.id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId! } });
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: row.organizationId! } });
    assert.equal(user.displayName, input.contactName);
    assert.equal(user.preferredLocale, input.locale);
    assert.equal(organization.defaultLocale, input.locale);
  } finally {
    await prisma.$executeRawUnsafe('REVOKE ALL ON "AccessRequest", "Organization", "User", "Membership", "AccountActivationIntent", "AuditLog", "AuthAuditEvent" FROM access_approval_insert_proof');
    await prisma.$executeRawUnsafe('REVOKE USAGE ON SCHEMA public FROM access_approval_insert_proof');
    await prisma.$executeRawUnsafe('DROP ROLE access_approval_insert_proof');
  }
});
