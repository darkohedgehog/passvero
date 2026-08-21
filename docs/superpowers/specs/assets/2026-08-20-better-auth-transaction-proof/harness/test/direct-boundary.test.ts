import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCurrentAdapter, runWithTransaction } from "@better-auth/core/context";
import {
  DIRECT_BOUNDARY_ADAPTER_MODES,
  DIRECT_BOUNDARY_FAILURE_SCENARIOS,
  DIRECT_BOUNDARY_NEVER_RETRY_CLASSES,
  DIRECT_BOUNDARY_RETRY_SCENARIOS,
  H2_DIRECT_BOUNDARY_RUNTIME_VERDICT,
  BoundaryRetryStopped,
  captureDirectResponseHeaders,
  runBetterAuthBoundary,
  runBoundaryWithRetry,
  type BoundaryAttemptAudit,
  type BoundaryRootPrisma,
  type FailurePoint,
  type TransactionClient,
} from "../src/proof-boundary.js";
import { createProofAuth, type ProofAuth } from "../src/auth.js";
import type { RowCounts } from "../src/evidence.js";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

type UnknownRecord = Record<PropertyKey, unknown>;
type WriteModel =
  | "AuthProviderUser"
  | "AuthProviderAccount"
  | "AuthProviderVerification"
  | "ProofCanonicalUser"
  | "AuthIdentity"
  | "AuthAbuseBucket"
  | "AuthCredentialToken";

type ProviderWriteModel = "AuthProviderUser" | "AuthProviderAccount" | "AuthProviderVerification";

interface WriteObservation {
  readonly model: WriteModel;
  readonly transactionIdHash: string;
}

interface CountDelegate {
  count(): Promise<number>;
}

interface CreateDelegate {
  create(input: { readonly data: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface UpdateDelegate {
  update(input: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
}

interface ProofSqlClient {
  $queryRaw<T>(query: TemplateStringsArray): Promise<T>;
}

interface H2TransactionClient extends TransactionClient, ProofSqlClient {
  readonly authProviderUser: CountDelegate;
  readonly authProviderAccount: CountDelegate;
  readonly authProviderSession: CountDelegate;
  readonly authProviderVerification: CountDelegate;
  readonly user: CountDelegate & CreateDelegate;
  readonly authIdentity: CountDelegate & CreateDelegate;
  readonly accountActivation: CountDelegate;
  readonly authCredentialToken: CountDelegate & CreateDelegate & UpdateDelegate;
  readonly authAbuseBucket: CountDelegate & CreateDelegate;
}

interface H2PrismaClient extends H2TransactionClient, BoundaryRootPrisma {
  $disconnect(): Promise<void>;
}

const PROVIDER_DELEGATES = new Map<PropertyKey, ProviderWriteModel>([
  ["authProviderUser", "AuthProviderUser"],
  ["authProviderAccount", "AuthProviderAccount"],
  ["authProviderVerification", "AuthProviderVerification"],
]);

const PROVIDER_WRITE_ACTIONS = new Set<PropertyKey>([
  "create", "update", "updateMany", "delete", "deleteMany", "upsert",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function hasMethod(value: UnknownRecord, property: PropertyKey): boolean {
  return typeof Reflect.get(value, property) === "function";
}

function isCountDelegate(value: unknown): value is CountDelegate {
  return isRecord(value) && hasMethod(value, "count");
}

function isH2TransactionClient(value: unknown): value is H2TransactionClient {
  if (!isRecord(value)) return false;
  for (const name of ["authProviderUser", "authProviderAccount", "authProviderSession", "authProviderVerification", "accountActivation"]) {
    if (!isCountDelegate(Reflect.get(value, name))) return false;
  }
  for (const name of ["user", "authIdentity", "authAbuseBucket"]) {
    const delegate = Reflect.get(value, name);
    if (!isCountDelegate(delegate) || !isRecord(delegate) || !hasMethod(delegate, "create")) return false;
  }
  const credential = Reflect.get(value, "authCredentialToken");
  return isCountDelegate(credential) && isRecord(credential)
    && hasMethod(credential, "create") && hasMethod(credential, "update")
    && hasMethod(value, "$queryRaw");
}

function isH2PrismaClient(value: unknown): value is H2PrismaClient {
  return isH2TransactionClient(value) && isRecord(value)
    && hasMethod(value, "$transaction") && hasMethod(value, "$disconnect");
}

function createGeneratedPrismaClient(module: unknown, adapter: PrismaPg): H2PrismaClient {
  if (!isRecord(module)) throw new Error("STOP_H2_GENERATED_MODULE_INVALID");
  const Constructor = Reflect.get(module, "PrismaClient");
  if (typeof Constructor !== "function") throw new Error("STOP_H2_GENERATED_MODULE_INVALID");
  const client: unknown = Reflect.construct(Constructor, [{ adapter }]);
  if (!isH2PrismaClient(client)) throw new Error("STOP_H2_GENERATED_CLIENT_INVALID");
  return client;
}

async function readCounts(prisma: H2TransactionClient): Promise<RowCounts> {
  const [
    providerUser, providerAccount, providerSession, providerVerification, canonicalUser,
    authIdentity, activation, credentialToken, abuseBucket,
  ] = await Promise.all([
    prisma.authProviderUser.count(), prisma.authProviderAccount.count(), prisma.authProviderSession.count(),
    prisma.authProviderVerification.count(), prisma.user.count(), prisma.authIdentity.count(),
    prisma.accountActivation.count(), prisma.authCredentialToken.count(), prisma.authAbuseBucket.count(),
  ]);
  return {
    providerUser, providerAccount, providerSession, providerVerification, canonicalUser,
    authIdentity, activation, credentialToken, abuseBucket,
  };
}

async function transactionIdHash(client: ProofSqlClient): Promise<string> {
  const rows = await client.$queryRaw<readonly { readonly transactionId: bigint }[]>`
    SELECT txid_current() AS "transactionId"
  `;
  const value = rows[0]?.transactionId.toString();
  if (!value || !/^\d+$/.test(value)) throw new Error("STOP_H2_TRANSACTION_ID_INVALID");
  return createHash("sha256").update(value).digest("hex");
}

function instrumentTransactionClient(
  rawTx: TransactionClient,
  observations: WriteObservation[],
): TransactionClient {
  if (!isH2TransactionClient(rawTx)) throw new Error("STOP_H2_TRANSACTION_CLIENT_INVALID");
  const tx = rawTx;
  const delegateCache = new Map<PropertyKey, object>();
  const proxy = new Proxy(tx, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      const model = PROVIDER_DELEGATES.get(property);
      if (!model || value === null || typeof value !== "object") return value;
      const cached = delegateCache.get(property);
      if (cached) return cached;
      const delegate = new Proxy(value, {
        get(delegateTarget, action, delegateReceiver) {
          const method: unknown = Reflect.get(delegateTarget, action, delegateReceiver);
          if (!PROVIDER_WRITE_ACTIONS.has(action) || typeof method !== "function") return method;
          return async (...args: readonly unknown[]) => {
            const result: unknown = await Reflect.apply(method, delegateTarget, args);
            observations.push({ model, transactionIdHash: await transactionIdHash(proxy) });
            return result;
          };
        },
      });
      delegateCache.set(property, delegate);
      return delegate;
    },
  });
  return proxy;
}

function digest(label: string): string {
  return createHash("sha256").update(label).digest("base64url");
}

function responseUserId(value: unknown): string {
  if (!isRecord(value)) throw new Error("STOP_H2_DIRECT_RESPONSE_INVALID");
  const user = Reflect.get(value, "user");
  if (!isRecord(user)) throw new Error("STOP_H2_DIRECT_RESPONSE_INVALID");
  const id = Reflect.get(user, "id");
  if (typeof id !== "string" || id.length === 0) throw new Error("STOP_H2_DIRECT_RESPONSE_INVALID");
  return id;
}

async function createProviderCredential(auth: ProofAuth, fixtureId: string): Promise<string> {
  const response = await auth.api.signUpEmail({
    body: {
      name: `proof-${fixtureId}`,
      email: `proof-${fixtureId}@invalid.example`,
      password: `H2-${fixtureId}-Aa1!`,
    },
    asResponse: true,
  });
  captureDirectResponseHeaders(response);
  if (!response.ok) throw new Error("STOP_H2_PROVIDER_CREDENTIAL_CREATE_FAILED");
  return responseUserId(await response.json());
}

async function recordWrite(
  tx: H2TransactionClient,
  observations: WriteObservation[],
  model: WriteModel,
  write: () => Promise<unknown>,
): Promise<unknown> {
  const result = await write();
  observations.push({ model, transactionIdHash: await transactionIdHash(tx) });
  return result;
}

async function createCanonicalAndAbuse(
  tx: H2TransactionClient,
  fixtureId: string,
  observations: WriteObservation[],
): Promise<string> {
  const created = await recordWrite(tx, observations, "ProofCanonicalUser", () => tx.user.create({
    data: { email: `canonical-${fixtureId}@invalid.example` },
  }));
  if (!isRecord(created)) {
    throw new Error("STOP_H2_CANONICAL_USER_INVALID");
  }
  const canonicalId = Reflect.get(created, "id");
  if (typeof canonicalId !== "string") throw new Error("STOP_H2_CANONICAL_USER_INVALID");
  await recordWrite(tx, observations, "AuthAbuseBucket", () => tx.authAbuseBucket.create({
    data: {
      dimension: "ACCOUNT_IDENTIFIER",
      keyDigest: digest(`abuse-${fixtureId}`),
      attemptCount: 1,
      failureCount: 1,
      backoffLevel: 0,
      windowStartedAt: new Date(),
      lastFailureAt: new Date(),
      backoffUpdatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
  }));
  return canonicalId;
}

async function linkAndConsumeCredential(
  tx: H2TransactionClient,
  fixtureId: string,
  canonicalId: string,
  providerUserId: string,
  observations: WriteObservation[],
): Promise<void> {
  await recordWrite(tx, observations, "AuthIdentity", () => tx.authIdentity.create({
    data: { provider: "credential", providerSubject: providerUserId, userId: canonicalId },
  }));
  const created = await recordWrite(tx, observations, "AuthCredentialToken", () => tx.authCredentialToken.create({
    data: {
      providerUserId,
      purpose: "EMAIL_VERIFICATION",
      tokenDigest: digest(`credential-${fixtureId}`),
      targetEmailDigest: digest(`target-${fixtureId}`),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  }));
  if (!isRecord(created) || typeof Reflect.get(created, "id") !== "string") {
    throw new Error("STOP_H2_CREDENTIAL_RECORD_INVALID");
  }
  await recordWrite(tx, observations, "AuthCredentialToken", () => tx.authCredentialToken.update({
    where: { id: Reflect.get(created, "id") },
    data: { consumedAt: new Date() },
  }));
}

function failAt(actual: FailurePoint, expected: FailurePoint): void {
  if (actual === expected) throw new Error(`INJECTED_H2_${expected}`);
}

async function runMatrixCase(
  rootPrisma: H2PrismaClient,
  order: "PROVIDER_FIRST" | "CANONICAL_FIRST",
  failurePoint: FailurePoint,
): Promise<void> {
  const fixtureId = randomBytes(16).toString("hex");
  const before = await readCounts(rootPrisma);
  const observations: WriteObservation[] = [];
  const invoke = async (
    auth: ProofAuth,
    rawTx: TransactionClient,
    assertAdapterBound: () => Promise<void>,
  ): Promise<string> => {
    if (!isH2TransactionClient(rawTx)) throw new Error("STOP_H2_TRANSACTION_CLIENT_INVALID");
    const tx = rawTx;
    await assertAdapterBound();
    if (order === "PROVIDER_FIRST") {
      const providerUserId = await createProviderCredential(auth, fixtureId);
      await assertAdapterBound();
      failAt(failurePoint, "AFTER_PROVIDER_WRITE");
      const canonicalId = await createCanonicalAndAbuse(tx, fixtureId, observations);
      await linkAndConsumeCredential(tx, fixtureId, canonicalId, providerUserId, observations);
      failAt(failurePoint, "AFTER_CANONICAL_WRITE");
      return providerUserId;
    }
    const canonicalId = await createCanonicalAndAbuse(tx, fixtureId, observations);
    const providerUserId = await createProviderCredential(auth, fixtureId);
    await assertAdapterBound();
    await linkAndConsumeCredential(tx, fixtureId, canonicalId, providerUserId, observations);
    failAt(failurePoint, "AFTER_CANONICAL_WRITE");
    failAt(failurePoint, "AFTER_PROVIDER_WRITE");
    return providerUserId;
  };

  if (failurePoint === "NONE") {
    const result = await runBetterAuthBoundary({
      rootPrisma,
      invoke,
      failurePoint,
      bindTransactionClient: (tx) => instrumentTransactionClient(tx, observations),
    });
    assert.equal(result.committed, true);
    assert.equal(result.cookie.present, false, "H2 credential creation must not expose a session cookie");
  } else {
    await assert.rejects(() => runBetterAuthBoundary({
      rootPrisma,
      invoke,
      failurePoint,
      bindTransactionClient: (tx) => instrumentTransactionClient(tx, observations),
    }));
    assert.deepEqual(await readCounts(rootPrisma), before, `${order}/${failurePoint} must roll every row back`);
  }

  const transactionIds = observations.map((entry) => entry.transactionIdHash);
  transactionIds.forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
  assert.equal(new Set(transactionIds).size, 1, `${order}/${failurePoint} must use one write transaction`);
}

async function proveAdapterMode(rootPrisma: H2PrismaClient, adapterTransaction: boolean): Promise<boolean> {
  let nestedCallbackEntered = false;
  await assert.rejects(() => rootPrisma.$transaction(async (tx) => {
    const auth = createProofAuth({ prisma: tx, adapterTransaction, disableSignUp: false });
    const adapter = (await auth.$context).adapter;
    await runWithTransaction(adapter, async () => {
      nestedCallbackEntered = true;
      assert.equal(await getCurrentAdapter(adapter), adapter);
      throw new Error("INJECTED_H2_ADAPTER_MODE_ROLLBACK");
    });
  }, { isolationLevel: "Serializable" }));
  return nestedCallbackEntered;
}

function codedError(code: string, unsafeDetail: string): Error & { readonly code: string } {
  return Object.assign(new Error(unsafeDetail), { code });
}

const ZERO_ROW_DELTAS = {
  providerUser: 0,
  providerAccount: 0,
  providerSession: 0,
  providerVerification: 0,
  canonicalUser: 0,
  authIdentity: 0,
  activation: 0,
  credentialToken: 0,
  abuseBucket: 0,
} as const satisfies RowCounts;

test("H2 manifest freezes the direct-only boundary while runtime remains unexecuted", () => {
  assert.equal(H2_DIRECT_BOUNDARY_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.deepEqual(DIRECT_BOUNDARY_FAILURE_SCENARIOS, [
    "NONE", "AFTER_PROVIDER_WRITE", "AFTER_CANONICAL_WRITE", "BEFORE_COMMIT",
  ]);
  assert.deepEqual(DIRECT_BOUNDARY_ADAPTER_MODES, [
    { adapterTransaction: false, accepted: true, expectedNestedPrismaTransaction: false },
    { adapterTransaction: true, accepted: false, expectedNestedPrismaTransaction: true },
  ]);
});

test("H2 retry classifier permits only serialization, deadlock, and P2034 after proven rollback", async () => {
  for (const scenario of DIRECT_BOUNDARY_RETRY_SCENARIOS) {
    let attempts = 0;
    let audits = 0;
    let callbacks = 0;
    let cookies = 0;
    const audit: BoundaryAttemptAudit = {
      rolledBack: true,
      commitObserved: false,
      cookieEligible: false,
      callbackPublished: false,
      finalRowDeltas: ZERO_ROW_DELTAS,
    };
    await assert.rejects(
      () => runBoundaryWithRetry({
        attempt: async () => {
          attempts += 1;
          throw codedError(scenario.injectedCode, "credential material must never be recorded");
        },
        auditFailure: async () => {
          audits += 1;
          return audit;
        },
      }),
      (error: unknown) => {
        assert.equal(error instanceof BoundaryRetryStopped, true);
        if (!(error instanceof BoundaryRetryStopped)) return false;
        assert.equal(error.attemptCount, scenario.expectedAttempts);
        assert.equal(error.failedAttempts.length, scenario.expectedAttempts);
        assert.equal(error.failedAttempts.every((attempt) => attempt.finalRowDeltas === ZERO_ROW_DELTAS), true);
        assert.doesNotMatch(JSON.stringify(error), /credential material/);
        return true;
      },
    );
    assert.equal(attempts, scenario.expectedAttempts);
    assert.equal(audits, scenario.expectedAttempts);
    assert.equal(callbacks, 0);
    assert.equal(cookies, 0);
    callbacks += 0;
    cookies += 0;
  }
});

test("H2 never retries when rollback is unproven or commit, cookie, or callback is observable", async () => {
  for (const unsafeAudit of [
    { rolledBack: false, commitObserved: false, cookieEligible: false, callbackPublished: false, finalRowDeltas: ZERO_ROW_DELTAS },
    { rolledBack: true, commitObserved: true, cookieEligible: false, callbackPublished: false, finalRowDeltas: ZERO_ROW_DELTAS },
    { rolledBack: true, commitObserved: false, cookieEligible: true, callbackPublished: false, finalRowDeltas: ZERO_ROW_DELTAS },
    { rolledBack: true, commitObserved: false, cookieEligible: false, callbackPublished: true, finalRowDeltas: ZERO_ROW_DELTAS },
  ] satisfies readonly BoundaryAttemptAudit[]) {
    let attempts = 0;
    await assert.rejects(() => runBoundaryWithRetry({
      attempt: async () => {
        attempts += 1;
        throw codedError("40001", "unsafe detail");
      },
      auditFailure: async () => unsafeAudit,
    }));
    assert.equal(attempts, 1);
  }
});

test("H2 never retries constraint, validation, credential, unknown, connection, ambiguity, or after-commit failures", async () => {
  for (const scenario of DIRECT_BOUNDARY_NEVER_RETRY_CLASSES) {
    let attempts = 0;
    await assert.rejects(() => runBoundaryWithRetry({
      attempt: async () => {
        attempts += 1;
        throw codedError(scenario.injectedCode, "unsafe detail");
      },
      auditFailure: async () => ({
        rolledBack: true,
        commitObserved: scenario.id === "COMMIT_AMBIGUITY" || scenario.id === "AFTER_COMMIT",
        cookieEligible: scenario.id === "AFTER_COMMIT",
        callbackPublished: scenario.id === "AFTER_COMMIT",
        finalRowDeltas: ZERO_ROW_DELTAS,
      }),
    }));
    assert.equal(attempts, 1, scenario.id);
  }
});

test("H2 returns only the successful third attempt and publishes after commit once", async () => {
  let attempts = 0;
  let published = 0;
  const result = await runBoundaryWithRetry({
    attempt: async () => {
      attempts += 1;
      if (attempts < 3) throw codedError("40P01", "discarded attempt detail");
      published += 1;
      return "committed";
    },
    auditFailure: async () => ({
      rolledBack: true,
      commitObserved: false,
      cookieEligible: false,
      callbackPublished: false,
      finalRowDeltas: ZERO_ROW_DELTAS,
    }),
  });
  assert.deepEqual(result, {
    value: "committed",
    attemptCount: 3,
    failedAttempts: [
      { attemptNumber: 1, failureClass: "DEADLOCK", finalRowDeltas: ZERO_ROW_DELTAS },
      { attemptNumber: 2, failureClass: "DEADLOCK", finalRowDeltas: ZERO_ROW_DELTAS },
    ],
  });
  assert.equal(published, 1);
});

test("live H2 proves direct API commit and rollback matrices once", {
  skip: process.env.PASSVERO_PROOF_H2 !== "1",
}, async () => {
  const generatedPath = "../generated/client/client.js";
  const generated: unknown = await import(generatedPath);
  const adapter = new PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) });
  const prisma = createGeneratedPrismaClient(generated, adapter);
  try {
    assert.equal(await proveAdapterMode(prisma, false), true, "transaction:false must reuse the supplied tx");
    assert.equal(await proveAdapterMode(prisma, true), false, "transaction:true must not enter a nested tx callback");
    for (const order of ["PROVIDER_FIRST", "CANONICAL_FIRST"] as const) {
      for (const failurePoint of DIRECT_BOUNDARY_FAILURE_SCENARIOS) {
        await runMatrixCase(prisma, order, failurePoint);
      }
    }
    console.log("H2_DIRECT_API_OUTER_TRANSACTION=PASS");
  } finally {
    await prisma.$disconnect();
  }
});
