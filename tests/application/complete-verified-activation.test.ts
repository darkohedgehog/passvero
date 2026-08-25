import assert from "node:assert/strict";
import test from "node:test";

import {
  createVerifiedActivationCompletionService,
  type VerifiedActivationDependencies,
} from "../../src/application/auth/complete-verified-activation";

const verifiedProvider: {
  readonly providerSubject: string;
  readonly email: string;
} = {
  providerSubject: "provider-1",
  email: "person@example.com",
} as const;

function fixture(overrides: {
  readonly provider?: typeof verifiedProvider;
  readonly activation?: {
    readonly id: string;
    readonly userId: string;
    readonly status: "AUTH_ACCOUNT_CREATED" | "EMAIL_VERIFIED" | "BOUND";
    readonly intendedEmailDigest: string;
    readonly canonicalEmail: string;
  } | null;
  readonly emailMatches?: boolean;
  readonly subjectIdentity?: {
    readonly id: string;
    readonly userId: string;
    readonly revokedAt: Date | null;
  } | null;
  readonly userIdentity?: {
    readonly id: string;
    readonly providerSubject: string;
    readonly revokedAt: Date | null;
  } | null;
  readonly bound?: boolean;
} = {}) {
  const calls: Array<{ readonly name: string; readonly input: unknown }> = [];
  const transaction = { id: "transaction-1" };
  const dependencies: VerifiedActivationDependencies<typeof transaction> = {
    transactionRunner: {
      async run(work) {
        calls.push({ name: "transaction:start", input: null });
        const result = await work(transaction);
        calls.push({ name: "transaction:commit", input: null });
        return result;
      },
    },
    intendedEmailDigester: {
      async matches(input) {
        calls.push({ name: "emailMatches", input });
        return overrides.emailMatches ?? true;
      },
    },
    persistence: {
      async findActivationByProviderSubject(received, providerSubject) {
        assert.strictEqual(received, transaction);
        calls.push({ name: "findActivation", input: providerSubject });
        return overrides.activation === undefined
          ? {
            id: "intent-1",
            userId: "user-1",
            status: "AUTH_ACCOUNT_CREATED",
            intendedEmailDigest: "email-digest",
            canonicalEmail: "person@example.com",
          }
          : overrides.activation;
      },
      async findIdentityByProviderSubject(received, providerSubject) {
        assert.strictEqual(received, transaction);
        calls.push({ name: "findSubjectIdentity", input: providerSubject });
        return overrides.subjectIdentity ?? null;
      },
      async findIdentityForUser(received, userId) {
        assert.strictEqual(received, transaction);
        calls.push({ name: "findUserIdentity", input: userId });
        return overrides.userIdentity ?? null;
      },
      async createIdentity(received, input) {
        assert.strictEqual(received, transaction);
        calls.push({ name: "createIdentity", input });
        return { identityId: "identity-1" };
      },
      async markActivationBound(received, input) {
        assert.strictEqual(received, transaction);
        calls.push({ name: "markBound", input });
        return overrides.bound ?? true;
      },
      async createAuditEvent(received, input) {
        assert.strictEqual(received, transaction);
        calls.push({ name: "audit", input });
      },
    },
    now: () => new Date("2026-08-25T11:00:00.000Z"),
  };

  return {
    calls,
    complete: createVerifiedActivationCompletionService(dependencies),
    input: overrides.provider ?? verifiedProvider,
  };
}

test("binds a verified provider subject exactly once in one business transaction", async () => {
  const { complete, calls, input } = fixture();

  assert.deepEqual(await complete(input, "correlation-1"), {
    status: "BOUND",
    userId: "user-1",
  });
  assert.deepEqual(calls.map((call) => call.name), [
    "transaction:start",
    "findActivation",
    "emailMatches",
    "findSubjectIdentity",
    "findUserIdentity",
    "createIdentity",
    "markBound",
    "audit",
    "transaction:commit",
  ]);
  assert.deepEqual(calls.find((call) => call.name === "audit")?.input, {
    userId: "user-1",
    authIdentityId: "identity-1",
    action: "AUTH_IDENTITY_BOUND",
    summary: "Verified authentication identity bound.",
    metadata: { provider: "BETTER_AUTH" },
    correlationId: "correlation-1",
    occurredAt: new Date("2026-08-25T11:00:00.000Z"),
  });
});

test("denies email-mismatched and same-email-only provider identities", async () => {
  const mismatchedEmail = fixture({
    provider: { ...verifiedProvider, email: "other@example.com" },
  });
  assert.deepEqual(
    await mismatchedEmail.complete(mismatchedEmail.input, "correlation-1"),
    { status: "DENIED" },
  );

  const noSubjectActivation = fixture({ activation: null });
  assert.deepEqual(
    await noSubjectActivation.complete(noSubjectActivation.input, "correlation-1"),
    { status: "DENIED" },
  );
});

test("is idempotent only for the same active subject and user", async () => {
  const existing = fixture({
    activation: {
      id: "intent-1",
      userId: "user-1",
      status: "BOUND",
      intendedEmailDigest: "email-digest",
      canonicalEmail: "person@example.com",
    },
    subjectIdentity: {
      id: "identity-1",
      userId: "user-1",
      revokedAt: null,
    },
  });

  assert.deepEqual(await existing.complete(existing.input, "correlation-1"), {
    status: "ALREADY_BOUND",
    userId: "user-1",
  });
  assert.equal(existing.calls.some((call) => call.name === "createIdentity"), false);
});

test("fails closed for revoked, cross-user, or alternate-subject conflicts", async () => {
  const conflicts = [
    fixture({
      subjectIdentity: {
        id: "identity-1",
        userId: "user-1",
        revokedAt: new Date(),
      },
    }),
    fixture({
      subjectIdentity: {
        id: "identity-1",
        userId: "user-2",
        revokedAt: null,
      },
    }),
    fixture({
      userIdentity: {
        id: "identity-2",
        providerSubject: "provider-2",
        revokedAt: null,
      },
    }),
    fixture({ bound: false }),
  ];

  for (const value of conflicts) {
    assert.deepEqual(await value.complete(value.input, "correlation-1"), {
      status: "DENIED",
    });
  }
});
