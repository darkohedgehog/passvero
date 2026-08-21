import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ACTIVATION_MATRIX,
  CONTROLLED_ACTIVATION_FAILURE_POINTS,
  H4_CONTROLLED_ACTIVATION_RUNTIME_VERDICT,
  createControlledActivationAuth,
  controlledActivationPlugin,
  type ControlledActivationApi,
} from "../src/auth.js";
import {
  BoundaryAttemptFailed,
  captureDirectResponseHeaders,
  runBetterAuthBoundary,
  runCapturedBoundaryAttempt,
  type BoundaryRootPrisma,
  type DirectAuthApi,
  type TransactionClient,
} from "../src/proof-boundary.js";
import { deltaRowCounts, EMPTY_DEFERRED_COOKIE, HYPOTHESIS_FAILURE_CODES, type RowCounts } from "../src/evidence.js";
import { buildConnectionString, readRunIdentity, writeHypothesisAssertionResult, writeHypothesisResult } from "../src/run-root.js";

type UnknownRecord = Record<PropertyKey, unknown>;
type ActivationFailurePoint = (typeof CONTROLLED_ACTIVATION_FAILURE_POINTS)[number];
type ProviderWriteModel = "AuthProviderUser" | "AuthProviderAccount";

interface WriteObservation {
  readonly model: ProviderWriteModel | "AccountActivation" | "AuthIdentity" | "AuthAbuseBucket";
  readonly transactionIdHash: string;
}

interface CountDelegate {
  count(): Promise<number>;
}

interface CreateDelegate {
  create(input: { readonly data: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface FindUniqueDelegate {
  findUnique(input: { readonly where: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface FindFirstDelegate {
  findFirst(input: { readonly where: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface UpdateDelegate {
  update(input: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
}

interface UpdateManyDelegate {
  updateMany(input: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
}

interface ProofSqlClient {
  $queryRaw<T>(query: TemplateStringsArray): Promise<T>;
}

interface H4TransactionClient extends TransactionClient, ProofSqlClient {
  readonly authProviderUser: CountDelegate & FindUniqueDelegate;
  readonly authProviderAccount: CountDelegate;
  readonly authProviderSession: CountDelegate;
  readonly authProviderVerification: CountDelegate;
  readonly user: CountDelegate & CreateDelegate & FindUniqueDelegate;
  readonly authIdentity: CountDelegate & CreateDelegate & FindFirstDelegate;
  readonly accountActivation: CountDelegate & CreateDelegate & FindUniqueDelegate & UpdateManyDelegate;
  readonly authCredentialToken: CountDelegate;
  readonly authAbuseBucket: CountDelegate & CreateDelegate & FindUniqueDelegate & UpdateDelegate;
}

interface H4PrismaClient extends H4TransactionClient, BoundaryRootPrisma {
  $disconnect(): Promise<void>;
}

interface ActivationFixture {
  readonly activationId: string;
  readonly abuseBucketId: string;
  readonly canonicalUserId: string;
  readonly credential: string;
  readonly email: string;
  readonly name: string;
  readonly providerSubject: string;
  readonly token: string;
}

interface ActivationResult {
  readonly providerUserId: string;
  readonly transactionIds: readonly string[];
}

type ProviderSeed = Pick<ActivationFixture, "credential" | "email" | "name" | "providerSubject">;

const PROVIDER_DELEGATES = new Map<PropertyKey, ProviderWriteModel>([
  ["authProviderUser", "AuthProviderUser"],
  ["authProviderAccount", "AuthProviderAccount"],
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

function hasServerOnlyMetadata(endpoint: unknown): boolean {
  if (endpoint === null || (typeof endpoint !== "object" && typeof endpoint !== "function")) return false;
  const options = Reflect.get(endpoint, "options");
  if (!isRecord(options)) return false;
  const metadata = Reflect.get(options, "metadata");
  return isRecord(metadata) && Reflect.get(metadata, "SERVER_ONLY") === true;
}

function isCountDelegate(value: unknown): value is CountDelegate {
  return isRecord(value) && hasMethod(value, "count");
}

function hasDelegateMethods(value: unknown, methods: readonly PropertyKey[]): boolean {
  return isRecord(value) && methods.every((method) => hasMethod(value, method));
}

function isH4TransactionClient(value: unknown): value is H4TransactionClient {
  if (!isRecord(value) || !hasMethod(value, "$queryRaw")) return false;
  for (const name of [
    "authProviderUser", "authProviderAccount", "authProviderSession", "authProviderVerification",
    "user", "authIdentity", "accountActivation", "authCredentialToken", "authAbuseBucket",
  ]) {
    if (!isCountDelegate(Reflect.get(value, name))) return false;
  }
  return hasDelegateMethods(Reflect.get(value, "authProviderUser"), ["findUnique"])
    && hasDelegateMethods(Reflect.get(value, "user"), ["create", "findUnique"])
    && hasDelegateMethods(Reflect.get(value, "authIdentity"), ["create", "findFirst"])
    && hasDelegateMethods(Reflect.get(value, "accountActivation"), ["create", "findUnique", "updateMany"])
    && hasDelegateMethods(Reflect.get(value, "authAbuseBucket"), ["create", "findUnique", "update"]);
}

function isH4PrismaClient(value: unknown): value is H4PrismaClient {
  return isH4TransactionClient(value) && isRecord(value)
    && hasMethod(value, "$transaction") && hasMethod(value, "$disconnect");
}

function createGeneratedPrismaClient(module: unknown, adapter: PrismaPg): H4PrismaClient {
  if (!isRecord(module)) throw new Error("STOP_H4_GENERATED_MODULE_INVALID");
  const Constructor = Reflect.get(module, "PrismaClient");
  if (typeof Constructor !== "function") throw new Error("STOP_H4_GENERATED_MODULE_INVALID");
  const client: unknown = Reflect.construct(Constructor, [{ adapter }]);
  if (!isH4PrismaClient(client)) throw new Error("STOP_H4_GENERATED_CLIENT_INVALID");
  return client;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function fixtureLabel(): string {
  return randomBytes(16).toString("hex");
}

function providerConflictSeed(
  fixture: ActivationFixture,
  conflict: "EMAIL" | "SUBJECT",
  distinctValue: string,
): ProviderSeed {
  return {
    credential: fixture.credential,
    email: conflict === "EMAIL" ? fixture.email : distinctValue,
    name: fixture.name,
    providerSubject: conflict === "SUBJECT" ? fixture.providerSubject : distinctValue,
  };
}

function requiredString(value: unknown, stop: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(stop);
  return value;
}

function requiredDate(value: unknown, stop: string): Date {
  if (!(value instanceof Date)) throw new Error(stop);
  return value;
}

async function readCounts(prisma: H4TransactionClient): Promise<RowCounts> {
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
  if (!value || !/^\d+$/.test(value)) throw new Error("STOP_H4_TRANSACTION_ID_INVALID");
  return createHash("sha256").update(value).digest("hex");
}

function instrumentTransactionClient(
  rawTx: TransactionClient,
  observations: WriteObservation[],
): TransactionClient {
  if (!isH4TransactionClient(rawTx)) throw new Error("STOP_H4_TRANSACTION_CLIENT_INVALID");
  const tx = rawTx;
  const delegateCache = new Map<PropertyKey, object>();
  return new Proxy(tx, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      const model = PROVIDER_DELEGATES.get(property);
      if (!model || !isRecord(value)) return value;
      const cached = delegateCache.get(property);
      if (cached) return cached;
      const delegate = new Proxy(value, {
        get(delegateTarget, action, delegateReceiver) {
          const method: unknown = Reflect.get(delegateTarget, action, delegateReceiver);
          if (!PROVIDER_WRITE_ACTIONS.has(action) || typeof method !== "function") return method;
          return async (...args: readonly unknown[]) => {
            const result: unknown = await Reflect.apply(method, delegateTarget, args);
            observations.push({ model, transactionIdHash: await transactionIdHash(tx) });
            return result;
          };
        },
      });
      delegateCache.set(property, delegate);
      return delegate;
    },
  });
}

async function recordWrite(
  tx: H4TransactionClient,
  observations: WriteObservation[],
  model: WriteObservation["model"],
  write: () => Promise<unknown>,
): Promise<unknown> {
  const result = await write();
  observations.push({ model, transactionIdHash: await transactionIdHash(tx) });
  return result;
}

async function preprovisionActivation(
  prisma: H4PrismaClient,
  options: {
    readonly expired?: boolean;
    readonly intendedEmailDigest?: string;
    readonly invalidated?: boolean;
    readonly providerSubject?: string;
  } = {},
): Promise<ActivationFixture> {
  const label = fixtureLabel();
  const email = `activation-${label}@invalid.example`;
  const token = `activation-token-${label}`;
  const now = new Date();
  const createdAt = options.expired ? new Date(now.getTime() - 120_000) : now;
  const expiresAt = options.expired
    ? new Date(now.getTime() - 60_000)
    : new Date(now.getTime() + 60_000);
  const canonical = await prisma.user.create({ data: { email } });
  const canonicalUserId = requiredString(
    isRecord(canonical) ? Reflect.get(canonical, "id") : null,
    "STOP_H4_CANONICAL_USER_INVALID",
  );
  const activation = await prisma.accountActivation.create({
    data: {
      userId: canonicalUserId,
      tokenDigest: digest(token),
      intendedEmailDigest: options.intendedEmailDigest ?? digest(email),
      createdAt,
      expiresAt,
      invalidatedAt: options.invalidated ? now : null,
    },
  });
  const abuse = await prisma.authAbuseBucket.create({
    data: {
      dimension: "ACCOUNT_IDENTIFIER",
      keyDigest: digest(`activation-abuse-${label}`),
      attemptCount: 1,
      failureCount: 1,
      backoffLevel: 1,
      windowStartedAt: now,
      lastFailureAt: now,
      backoffUpdatedAt: now,
      blockedUntil: new Date(now.getTime() + 1_000),
      expiresAt: new Date(now.getTime() + 60_000),
    },
  });
  return {
    activationId: requiredString(
      isRecord(activation) ? Reflect.get(activation, "id") : null,
      "STOP_H4_ACTIVATION_INVALID",
    ),
    abuseBucketId: requiredString(
      isRecord(abuse) ? Reflect.get(abuse, "id") : null,
      "STOP_H4_ABUSE_BUCKET_INVALID",
    ),
    canonicalUserId,
    credential: `H4-${label}-Aa1!`,
    email,
    name: `proof-${label}`,
    providerSubject: options.providerSubject ?? `h4-provider-${label}`,
    token,
  };
}

function providerUserId(value: unknown): string {
  if (!isRecord(value)) throw new Error("STOP_H4_ACTIVATION_RESPONSE_INVALID");
  const user = Reflect.get(value, "user");
  if (!isRecord(user)) throw new Error("STOP_H4_ACTIVATION_RESPONSE_INVALID");
  assert.equal(Reflect.get(user, "emailVerified"), false);
  return requiredString(Reflect.get(user, "id"), "STOP_H4_ACTIVATION_RESPONSE_INVALID");
}

async function observeControlledActivationResponse(response: Response): Promise<string> {
  captureDirectResponseHeaders(response);
  const cookieHeader = ["set", "cookie"].join("-");
  if (response.headers.has(cookieHeader)) {
    throw new Error("STOP_H4_CONTROLLED_ACTIVATION_COOKIE_PRESENT");
  }
  if (!response.ok) throw new Error("STOP_H4_PROVIDER_CREDENTIAL_CREATE_FAILED");
  return providerUserId(await response.json());
}

function failAt(actual: ActivationFailurePoint, expected: ActivationFailurePoint): void {
  if (actual === expected) throw new Error(`INJECTED_H4_${expected}`);
}

async function activate(
  rootPrisma: H4PrismaClient,
  fixture: ActivationFixture,
  failurePoint: ActivationFailurePoint = "NONE",
): Promise<ActivationResult> {
  const observations: WriteObservation[] = [];
  const result = await runBetterAuthBoundary({
    rootPrisma,
    failurePoint: "NONE",
    bindTransactionClient: (tx) => instrumentTransactionClient(tx, observations),
    invoke: async (_h2Api: DirectAuthApi, rawTx: TransactionClient, assertAdapterBound) => {
      if (!isH4TransactionClient(rawTx)) throw new Error("STOP_H4_TRANSACTION_CLIENT_INVALID");
      const tx = rawTx;
      await assertAdapterBound();
      const tokenDigest = digest(fixture.token);
      const activation = await tx.accountActivation.findUnique({ where: { tokenDigest } });
      if (!isRecord(activation)) throw new Error("ACTIVATION_REJECTED");
      const expiresAt = requiredDate(Reflect.get(activation, "expiresAt"), "STOP_H4_ACTIVATION_INVALID");
      if (Reflect.get(activation, "consumedAt") !== null
        || Reflect.get(activation, "invalidatedAt") !== null
        || expiresAt <= new Date()) throw new Error("ACTIVATION_REJECTED");

      const activationUserId = requiredString(
        Reflect.get(activation, "userId"),
        "STOP_H4_ACTIVATION_INVALID",
      );
      if (activationUserId !== fixture.canonicalUserId) throw new Error("ACTIVATION_REJECTED");
      const canonical = await tx.user.findUnique({ where: { id: activationUserId } });
      if (!isRecord(canonical)) throw new Error("ACTIVATION_REJECTED");
      const canonicalEmail = requiredString(Reflect.get(canonical, "email"), "STOP_H4_CANONICAL_USER_INVALID");
      const intendedEmailDigest = requiredString(
        Reflect.get(activation, "intendedEmailDigest"),
        "STOP_H4_ACTIVATION_INVALID",
      );
      if (digest(canonicalEmail.toLowerCase()) !== intendedEmailDigest
        || digest(fixture.email.toLowerCase()) !== intendedEmailDigest) throw new Error("ACTIVATION_REJECTED");
      if (await tx.authProviderUser.findUnique({ where: { email: fixture.email.toLowerCase() } })) {
        throw new Error("ACTIVATION_REJECTED");
      }
      if (await tx.authProviderUser.findUnique({ where: { id: fixture.providerSubject } })) {
        throw new Error("ACTIVATION_REJECTED");
      }
      if (await tx.authIdentity.findFirst({
        where: {
          OR: [
            { provider: "credential", providerSubject: fixture.providerSubject },
            { provider: "credential", userId: fixture.canonicalUserId },
          ],
        },
      })) throw new Error("ACTIVATION_REJECTED");

      const consumed = await recordWrite(tx, observations, "AccountActivation", () => (
        tx.accountActivation.updateMany({
          where: {
            id: fixture.activationId,
            consumedAt: null,
            invalidatedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        })
      ));
      if (!isRecord(consumed) || Reflect.get(consumed, "count") !== 1) throw new Error("ACTIVATION_REJECTED");

      const auth = createControlledActivationAuth(tx);
      const response = await auth.api.activatePreprovisionedCredential({
        body: {
          credential: fixture.credential,
          email: fixture.email,
          name: fixture.name,
          providerSubject: fixture.providerSubject,
        },
        asResponse: true,
      });
      await assertAdapterBound();
      const activatedProviderUserId = await observeControlledActivationResponse(response);
      assert.equal(activatedProviderUserId, fixture.providerSubject);
      failAt(failurePoint, "AFTER_PROVIDER_CREDENTIAL_CREATION");

      await recordWrite(tx, observations, "AuthIdentity", () => tx.authIdentity.create({
        data: {
          provider: "credential",
          providerSubject: activatedProviderUserId,
          userId: fixture.canonicalUserId,
        },
      }));
      failAt(failurePoint, "AFTER_AUTH_IDENTITY_CREATION");
      await recordWrite(tx, observations, "AuthAbuseBucket", () => tx.authAbuseBucket.update({
        where: { id: fixture.abuseBucketId },
        data: {
          attemptCount: 2,
          failureCount: 0,
          backoffLevel: 0,
          blockedUntil: null,
          backoffUpdatedAt: new Date(),
        },
      }));
      return activatedProviderUserId;
    },
  });
  assert.equal(result.cookie.present, false, "controlled activation must not expose a cookie");
  return {
    providerUserId: result.value,
    transactionIds: observations.map((entry) => entry.transactionIdHash),
  };
}

async function seedProviderCredential(
  rootPrisma: H4PrismaClient,
  input: ProviderSeed,
): Promise<void> {
  const result = await runBetterAuthBoundary({
    rootPrisma,
    failurePoint: "NONE",
    invoke: async (_h2Api, rawTx) => {
      const auth = createControlledActivationAuth(rawTx);
      const response = await auth.api.activatePreprovisionedCredential({ body: input, asResponse: true });
      return observeControlledActivationResponse(response);
    },
  });
  assert.equal(result.cookie.present, false);
}

async function assertActivationState(
  prisma: H4PrismaClient,
  fixture: ActivationFixture,
  providerUserIdValue: string,
): Promise<void> {
  const activation = await prisma.accountActivation.findUnique({ where: { id: fixture.activationId } });
  assert.ok(isRecord(activation) && Reflect.get(activation, "consumedAt") instanceof Date);
  const providerUser = await prisma.authProviderUser.findUnique({ where: { id: providerUserIdValue } });
  assert.ok(isRecord(providerUser));
  assert.equal(Reflect.get(providerUser, "emailVerified"), false);
  const identity = await prisma.authIdentity.findFirst({
    where: { provider: "credential", providerSubject: providerUserIdValue, userId: fixture.canonicalUserId },
  });
  assert.ok(identity);
  const abuse = await prisma.authAbuseBucket.findUnique({ where: { id: fixture.abuseBucketId } });
  assert.ok(isRecord(abuse));
  assert.equal(Reflect.get(abuse, "attemptCount"), 2);
  assert.equal(Reflect.get(abuse, "failureCount"), 0);
  assert.equal(Reflect.get(abuse, "backoffLevel"), 0);
  assert.equal(Reflect.get(abuse, "blockedUntil"), null);
}

async function assertRejectedWithoutDelta(
  prisma: H4PrismaClient,
  fixture: ActivationFixture,
): Promise<void> {
  const before = await readCounts(prisma);
  await assert.rejects(() => activate(prisma, fixture));
  assert.deepEqual(await readCounts(prisma), before);
}

test("H4 manifest freezes the server-only activation hypothesis while runtime remains unexecuted", () => {
  const plugin = controlledActivationPlugin();
  const endpoint = plugin.endpoints.activatePreprovisionedCredential;
  const compileTimeApi: Array<keyof ControlledActivationApi> = ["activatePreprovisionedCredential"];
  assert.deepEqual(compileTimeApi, ["activatePreprovisionedCredential"]);
  assert.equal(H4_CONTROLLED_ACTIVATION_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.deepEqual(CONTROLLED_ACTIVATION_FAILURE_POINTS, [
    "NONE", "AFTER_PROVIDER_CREDENTIAL_CREATION", "AFTER_AUTH_IDENTITY_CREATION",
  ]);
  assert.deepEqual(ACTIVATION_MATRIX, [
    "VALID_SINGLE_USE", "EXPIRED_TOKEN", "SUPERSEDED_TOKEN", "WRONG_CANONICAL_EMAIL_DIGEST",
    "EXISTING_PROVIDER_EMAIL", "EXISTING_PROVIDER_SUBJECT", "EXISTING_AUTH_IDENTITY",
    "TWO_CONCURRENT_CONSUMERS", "FAIL_AFTER_PROVIDER_CREDENTIAL_CREATION",
    "FAIL_AFTER_AUTH_IDENTITY_CREATION",
  ]);
  assert.equal(endpoint.path, undefined);
  assert.equal(endpoint.options.method, "POST");
  assert.equal(hasServerOnlyMetadata(endpoint), true);
});

test("H4 direct activation response rejects cookie metadata and records zero-cookie success", async () => {
  const body = JSON.stringify({ user: { id: "provider-subject", emailVerified: false } });
  const observed = await runCapturedBoundaryAttempt({
    transactionalWork: () => observeControlledActivationResponse(new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    })),
    failurePoint: "NONE",
  });
  assert.equal(observed.value, "provider-subject");
  assert.equal(observed.cookie.present, false);

  const cookieHeader = ["set", "cookie"].join("-");
  await assert.rejects(
    () => runCapturedBoundaryAttempt({
      transactionalWork: () => observeControlledActivationResponse(new Response(body, {
        status: 200,
        headers: { [cookieHeader]: "__Host-proof=opaque; Path=/; HttpOnly; Secure; SameSite=Lax" },
      })),
      failurePoint: "NONE",
    }),
    (error: unknown) => {
      assert.equal(error instanceof BoundaryAttemptFailed, true);
      if (!(error instanceof BoundaryAttemptFailed)) return false;
      assert.doesNotMatch(JSON.stringify(error), /__Host-proof|opaque|set-cookie/i);
      return error.commitObserved === false
        && error.cookieEligible === false
        && error.capturedCookieDiscarded === true;
    },
  );
});

test("H4 provider-conflict fixtures isolate email and subject guards", () => {
  const fixture: ActivationFixture = {
    activationId: "activation-id",
    abuseBucketId: "abuse-id",
    canonicalUserId: "canonical-id",
    credential: "H4-fixture-Aa1!",
    email: "target@invalid.example",
    name: "target",
    providerSubject: "target-subject",
    token: "activation-token",
  };
  const emailConflict = providerConflictSeed(fixture, "EMAIL", "distinct-subject");
  assert.equal(emailConflict.email, "target@invalid.example");
  assert.equal(emailConflict.providerSubject, "distinct-subject");
  assert.notEqual(emailConflict.providerSubject, fixture.providerSubject);

  const subjectConflict = providerConflictSeed(fixture, "SUBJECT", "distinct@invalid.example");
  assert.equal(subjectConflict.email, "distinct@invalid.example");
  assert.notEqual(subjectConflict.email, fixture.email);
  assert.equal(subjectConflict.providerSubject, "target-subject");
});

test("live H4 proves controlled activation and public signup rejection once", {
  skip: process.env.PASSVERO_PROOF_H4 !== "1",
}, async () => {
  const generatedPath = "../generated/client/client.js";
  const generated: unknown = await import(generatedPath);
  const adapter = new PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) });
  const prisma = createGeneratedPrismaClient(generated, adapter);
  const proofBefore = await readCounts(prisma);
  let proofAfter = proofBefore;
  const transactionIds: string[] = [];
  try {
    const surfaceFixture = await preprovisionActivation(prisma);
    await prisma.$transaction(async (tx) => {
      const auth = createControlledActivationAuth(tx);
      await assert.rejects(() => auth.api.signUpEmail({
        body: {
          name: surfaceFixture.name,
          email: surfaceFixture.email,
          password: surfaceFixture.credential,
        },
      }));
      const endpointEntries = Object.entries(auth.api);
      const signUpPaths = endpointEntries
        .map(([, endpoint]) => endpoint.path)
        .filter((path): path is string => typeof path === "string" && path.includes("sign-up"));
      assert.ok(signUpPaths.length > 0);
      const disabledPaths = new Set<string>(auth.options.disabledPaths ?? []);
      assert.equal(signUpPaths.every((path) => disabledPaths.has(path)), true);
      const controlled = auth.api.activatePreprovisionedCredential;
      assert.equal(controlled.path, undefined);
      assert.equal(hasServerOnlyMetadata(controlled), true);
      const publicSignup = await auth.handler(new Request(
        "https://auth-proof.invalid/internal-auth/sign-up/email",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: surfaceFixture.name,
            email: surfaceFixture.email,
            password: surfaceFixture.credential,
          }),
        },
      ));
      assert.equal(publicSignup.status, 404);
      const guessedControlledRoute = await auth.handler(new Request(
        "https://auth-proof.invalid/internal-auth/activate-preprovisioned-credential",
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      ));
      assert.equal(guessedControlledRoute.status, 404);
    }, { isolationLevel: "Serializable" });

    const valid = await preprovisionActivation(prisma);
    const beforeValid = await readCounts(prisma);
    const validResult = await activate(prisma, valid);
    const afterValid = await readCounts(prisma);
    assert.equal(afterValid.providerUser - beforeValid.providerUser, 1);
    assert.equal(afterValid.providerAccount - beforeValid.providerAccount, 1);
    assert.equal(afterValid.authIdentity - beforeValid.authIdentity, 1);
    assert.equal(afterValid.providerSession - beforeValid.providerSession, 0);
    assert.equal(afterValid.providerVerification - beforeValid.providerVerification, 0);
    assert.ok(validResult.transactionIds.length >= 5);
    assert.equal(new Set(validResult.transactionIds).size, 1);
    transactionIds.push(...validResult.transactionIds);
    await assertActivationState(prisma, valid, validResult.providerUserId);
    await assertRejectedWithoutDelta(prisma, valid);

    await assertRejectedWithoutDelta(prisma, await preprovisionActivation(prisma, { expired: true }));
    await assertRejectedWithoutDelta(prisma, await preprovisionActivation(prisma, { invalidated: true }));
    await assertRejectedWithoutDelta(prisma, await preprovisionActivation(prisma, {
      intendedEmailDigest: digest(`wrong-${fixtureLabel()}@invalid.example`),
    }));

    const existingEmail = await preprovisionActivation(prisma);
    const existingEmailSeed = providerConflictSeed(
      existingEmail,
      "EMAIL",
      `existing-email-seed-${fixtureLabel()}`,
    );
    assert.equal(existingEmailSeed.email, existingEmail.email);
    assert.notEqual(existingEmailSeed.providerSubject, existingEmail.providerSubject);
    await seedProviderCredential(prisma, existingEmailSeed);
    await assertRejectedWithoutDelta(prisma, existingEmail);

    const existingSubject = await preprovisionActivation(prisma);
    const existingSubjectSeed = providerConflictSeed(
      existingSubject,
      "SUBJECT",
      `provider-seed-${fixtureLabel()}@invalid.example`,
    );
    assert.notEqual(existingSubjectSeed.email, existingSubject.email);
    assert.equal(existingSubjectSeed.providerSubject, existingSubject.providerSubject);
    await seedProviderCredential(prisma, existingSubjectSeed);
    await assertRejectedWithoutDelta(prisma, existingSubject);

    const existingIdentity = await preprovisionActivation(prisma);
    await prisma.authIdentity.create({
      data: {
        provider: "credential",
        providerSubject: `existing-identity-${fixtureLabel()}`,
        userId: existingIdentity.canonicalUserId,
      },
    });
    await assertRejectedWithoutDelta(prisma, existingIdentity);

    const concurrent = await preprovisionActivation(prisma);
    const beforeConcurrent = await readCounts(prisma);
    const consumers = await Promise.allSettled([activate(prisma, concurrent), activate(prisma, concurrent)]);
    const winners = consumers.filter(
      (result): result is PromiseFulfilledResult<ActivationResult> => result.status === "fulfilled",
    );
    assert.equal(winners.length, 1);
    assert.equal(consumers.filter((result) => result.status === "rejected").length, 1);
    assert.equal(new Set(winners[0]?.value.transactionIds).size, 1);
    transactionIds.push(...(winners[0]?.value.transactionIds ?? []));
    const afterConcurrent = await readCounts(prisma);
    assert.equal(afterConcurrent.providerUser - beforeConcurrent.providerUser, 1);
    assert.equal(afterConcurrent.providerAccount - beforeConcurrent.providerAccount, 1);
    assert.equal(afterConcurrent.authIdentity - beforeConcurrent.authIdentity, 1);
    assert.equal(afterConcurrent.providerSession - beforeConcurrent.providerSession, 0);

    for (const failurePoint of [
      "AFTER_PROVIDER_CREDENTIAL_CREATION", "AFTER_AUTH_IDENTITY_CREATION",
    ] as const) {
      const fixture = await preprovisionActivation(prisma);
      const before = await readCounts(prisma);
      await assert.rejects(() => activate(prisma, fixture, failurePoint));
      assert.deepEqual(await readCounts(prisma), before, `${failurePoint} must roll every row back`);
      const activation = await prisma.accountActivation.findUnique({ where: { id: fixture.activationId } });
      assert.ok(isRecord(activation));
      assert.equal(Reflect.get(activation, "consumedAt"), null);
    }

    proofAfter = await readCounts(prisma);
    await writeHypothesisAssertionResult({
      id: "H4_CONTROLLED_ACTIVATION",
      status: "PASS",
      transactionIds,
      before: proofBefore,
      after: proofAfter,
      deltas: deltaRowCounts(proofBefore, proofAfter),
      cookie: EMPTY_DEFERRED_COOKIE,
      assertions: ["H4_CONTROLLED_ACTIVATION_ASSERTIONS_COMPLETE"],
      failureCode: null,
    });
  } catch (cause: unknown) {
    try {
      proofAfter = await readCounts(prisma);
      await writeHypothesisResult({
        id: "H4_CONTROLLED_ACTIVATION",
        status: "FAIL",
        transactionIds,
        before: proofBefore,
        after: proofAfter,
        deltas: deltaRowCounts(proofBefore, proofAfter),
        cookie: EMPTY_DEFERRED_COOKIE,
        assertions: [],
        failureCode: HYPOTHESIS_FAILURE_CODES.H4_CONTROLLED_ACTIVATION,
      });
    } catch { /* the original process failure remains authoritative */ }
    throw cause;
  } finally {
    await prisma.$disconnect();
  }
});
