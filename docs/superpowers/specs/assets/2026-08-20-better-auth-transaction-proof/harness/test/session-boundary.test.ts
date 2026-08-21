import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import type { DBAdapter } from "@better-auth/core/db/adapter";
import {
  H5_SESSION_BOUNDARY_RUNTIME_VERDICT,
  H5_SESSION_ROTATION_FEASIBILITY,
  NATIVE_SESSION_BEHAVIORS,
  SESSION_ABSOLUTE_MS,
  SESSION_INACTIVITY_MS,
  SESSION_PROOF_CASES,
  SESSION_REFRESH_MS,
  BoundaryAttemptFailed,
  captureDirectResponseHeaders,
  evaluateSessionPolicy,
  expireSessionWithBetterAuthAuthority,
  changePasswordWithBetterAuthAuthority,
  requiredAtomicRotationGuards,
  rotateSessionWithBetterAuthAuthority,
  revokeAllWithBetterAuthAuthority,
  runBoundaryWithRetry,
  runBetterAuthBoundary,
  runCapturedBoundaryAttempt,
  runSessionCommitStages,
  serverOwnedSessionAnchors,
  stageRotatedSessionCookie,
  type SessionProofRecord,
  type BoundaryRootPrisma,
  type TransactionClient,
} from "../src/proof-boundary.js";
import type { RowCounts } from "../src/evidence.js";
import { createControlledActivationAuth, createProofAuth } from "../src/auth.js";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

type UnknownRecord = Record<PropertyKey, unknown>;

interface CountDelegate {
  count(input?: { readonly where?: Readonly<Record<string, unknown>> }): Promise<number>;
}

interface FindUniqueDelegate {
  findUnique(input: { readonly where: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface SupportCreateDelegate {
  create(input: { readonly data: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface H5TransactionClient extends TransactionClient {
  readonly authProviderUser: CountDelegate;
  readonly authProviderAccount: CountDelegate;
  readonly authProviderSession: CountDelegate & FindUniqueDelegate;
  readonly authProviderVerification: CountDelegate;
  readonly user: CountDelegate;
  readonly authIdentity: CountDelegate;
  readonly accountActivation: CountDelegate;
  readonly authCredentialToken: CountDelegate;
  readonly authAbuseBucket: CountDelegate & SupportCreateDelegate;
}

interface H5PrismaClient extends H5TransactionClient, BoundaryRootPrisma {
  $disconnect(): Promise<void>;
}

interface SignInResult {
  readonly providerUserId: string;
  readonly token: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function hasMethod(value: UnknownRecord, property: PropertyKey): boolean {
  return typeof Reflect.get(value, property) === "function";
}

function isCountDelegate(value: unknown): value is CountDelegate {
  return isRecord(value) && hasMethod(value, "count");
}

function isH5TransactionClient(value: unknown): value is H5TransactionClient {
  if (!isRecord(value)) return false;
  for (const name of [
    "authProviderUser", "authProviderAccount", "authProviderSession", "authProviderVerification",
    "user", "authIdentity", "accountActivation", "authCredentialToken", "authAbuseBucket",
  ]) {
    if (!isCountDelegate(Reflect.get(value, name))) return false;
  }
  return isRecord(Reflect.get(value, "authProviderSession"))
    && hasMethod(Reflect.get(value, "authProviderSession") as UnknownRecord, "findUnique");
}

function isH5PrismaClient(value: unknown): value is H5PrismaClient {
  return isH5TransactionClient(value) && isRecord(value)
    && hasMethod(value, "$transaction") && hasMethod(value, "$disconnect");
}

function createGeneratedPrismaClient(module: unknown, adapter: PrismaPg): H5PrismaClient {
  if (!isRecord(module)) throw new Error("STOP_H5_GENERATED_MODULE_INVALID");
  const Constructor = Reflect.get(module, "PrismaClient");
  if (typeof Constructor !== "function") throw new Error("STOP_H5_GENERATED_MODULE_INVALID");
  const client: unknown = Reflect.construct(Constructor, [{ adapter }]);
  if (!isH5PrismaClient(client)) throw new Error("STOP_H5_GENERATED_CLIENT_INVALID");
  return client;
}

function requiredString(value: unknown, stop: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(stop);
  return value;
}

function requiredDate(value: unknown, stop: string): Date {
  if (!(value instanceof Date)) throw new Error(stop);
  return value;
}

function responseSignIn(value: unknown): SignInResult {
  if (!isRecord(value)) throw new Error("STOP_H5_SIGN_IN_RESPONSE_INVALID");
  const user = Reflect.get(value, "user");
  if (!isRecord(user)) throw new Error("STOP_H5_SIGN_IN_RESPONSE_INVALID");
  return {
    providerUserId: requiredString(Reflect.get(user, "id"), "STOP_H5_SIGN_IN_RESPONSE_INVALID"),
    token: requiredString(Reflect.get(value, "token"), "STOP_H5_SIGN_IN_RESPONSE_INVALID"),
  };
}

function proofSession(value: unknown): SessionProofRecord {
  if (!isRecord(value)) throw new Error("STOP_H5_SESSION_INVALID");
  const selected = Reflect.get(value, "selectedOrganizationId");
  if (selected !== null && typeof selected !== "string") throw new Error("STOP_H5_SESSION_INVALID");
  return {
    id: requiredString(Reflect.get(value, "id"), "STOP_H5_SESSION_INVALID"),
    userId: requiredString(Reflect.get(value, "userId"), "STOP_H5_SESSION_INVALID"),
    token: requiredString(Reflect.get(value, "token"), "STOP_H5_SESSION_INVALID"),
    expiresAt: requiredDate(Reflect.get(value, "expiresAt"), "STOP_H5_SESSION_INVALID"),
    authenticatedAt: requiredDate(Reflect.get(value, "authenticatedAt"), "STOP_H5_SESSION_INVALID"),
    lastRefreshAt: requiredDate(Reflect.get(value, "lastRefreshAt"), "STOP_H5_SESSION_INVALID"),
    selectedOrganizationId: selected,
  };
}

function fixtureLabel(): string {
  return randomBytes(16).toString("hex");
}

async function providerSessionCount(prisma: H5TransactionClient, userId?: string): Promise<number> {
  return prisma.authProviderSession.count(userId ? { where: { userId } } : undefined);
}

async function sessionByToken(prisma: H5TransactionClient, token: string): Promise<SessionProofRecord> {
  return proofSession(await prisma.authProviderSession.findUnique({ where: { token } }));
}

async function createCredential(
  prisma: H5PrismaClient,
  input: { readonly email: string; readonly password: string; readonly verified: boolean },
): Promise<string> {
  const result = await runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (_api, rawTx) => {
      const controlled = createControlledActivationAuth(rawTx);
      const response = await controlled.api.activatePreprovisionedCredential({
        body: {
          credential: input.password,
          name: `proof-${fixtureLabel()}`,
          email: input.email,
          providerSubject: `h5-provider-${fixtureLabel()}`,
        },
        asResponse: true,
      });
      captureDirectResponseHeaders(response);
      if (!response.ok) throw new Error("STOP_H5_CREDENTIAL_CREATE_FAILED");
      const body: unknown = await response.json();
      if (!isRecord(body)) throw new Error("STOP_H5_CREDENTIAL_CREATE_FAILED");
      const user = Reflect.get(body, "user");
      if (!isRecord(user)) throw new Error("STOP_H5_CREDENTIAL_CREATE_FAILED");
      const userId = requiredString(Reflect.get(user, "id"), "STOP_H5_CREDENTIAL_CREATE_FAILED");
      if (input.verified) {
        const verificationAuth = createProofAuth({
          prisma: rawTx,
          adapterTransaction: false,
          disableSignUp: true,
        });
        const verified = await (await verificationAuth.$context).adapter.update<{
          readonly id: string;
          readonly emailVerified: boolean;
        }>({
          model: "user",
          where: [{ field: "id", operator: "eq", value: userId }],
          update: { emailVerified: true },
        });
        if (!verified?.emailVerified) throw new Error("STOP_H5_CREDENTIAL_VERIFY_FAILED");
      }
      return userId;
    },
  });
  assert.equal(result.cookie.present, false);
  return result.value;
}

async function signIn(
  prisma: H5PrismaClient,
  input: {
    readonly email: string;
    readonly password: string;
    readonly failurePoint?: "NONE" | "AFTER_SESSION_WRITE" | "BEFORE_COMMIT";
    readonly bindTransactionClient?: (tx: TransactionClient) => TransactionClient;
    readonly afterCommit?: (value: SignInResult, response: Response) => void | Promise<void>;
    readonly beforeCommitStage?: (tx: TransactionClient) => void | Promise<void>;
    readonly hostileSessionAnchors?: Readonly<{
      readonly authenticatedAt: Date;
      readonly lastRefreshAt: Date;
      readonly selectedOrganizationId: string;
    }>;
  },
) {
  return runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: input.failurePoint ?? "NONE",
    bindTransactionClient: input.bindTransactionClient,
    afterCommit: input.afterCommit,
    beforeCommitStage: input.beforeCommitStage,
    invoke: async (api) => {
      const body = { email: input.email, password: input.password, ...input.hostileSessionAnchors };
      const response = await api.signInEmail({
        body,
        asResponse: true,
      });
      captureDirectResponseHeaders(response);
      if (!response.ok) throw new Error("STOP_H5_SIGN_IN_REJECTED");
      return responseSignIn(await response.json());
    },
  });
}

async function rotateSession(
  prisma: H5PrismaClient,
  input: {
    readonly currentSession: SessionProofRecord;
    readonly presentedToken: string;
    readonly rotatedToken: string;
    readonly now: Date;
  },
) {
  return runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (_api, _tx, _assertAdapterBound, context) => {
      const rotated = await rotateSessionWithBetterAuthAuthority(context.adapter, input);
      if (rotated) {
        stageRotatedSessionCookie({
          token: rotated.token,
          response: authoritativeCookieResponse(
            rotated.token,
            Math.floor((rotated.expiresAt.getTime() - input.now.getTime()) / 1_000),
          ),
          now: input.now,
          expiresAt: rotated.expiresAt,
          authenticatedAt: rotated.authenticatedAt,
          lastRefreshAt: rotated.lastRefreshAt,
        });
      }
      return rotated;
    },
  });
}

async function updateStoredSessionFixture(
  prisma: H5PrismaClient,
  sessionId: string,
  update: Readonly<Partial<Pick<
    SessionProofRecord,
    "expiresAt" | "lastRefreshAt" | "authenticatedAt"
  >>>,
): Promise<SessionProofRecord> {
  const result = await runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (_api, _tx, _assertAdapterBound, context) => {
      const stored = await context.adapter.update<SessionProofRecord>({
        model: "session",
        where: [{ field: "id", operator: "eq", value: sessionId }],
        update,
      });
      if (!stored) throw new Error("STOP_H5_SESSION_FIXTURE_UPDATE_FAILED");
      return stored;
    },
  });
  assert.equal(result.cookie.present, false);
  return result.value;
}

async function changePassword(
  prisma: H5PrismaClient,
  input: {
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly currentSession: SessionProofRecord;
    readonly rotatedToken: string;
    readonly now: Date;
  },
) {
  return runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (_api, _tx, _assertAdapterBound, context) => changePasswordWithBetterAuthAuthority({
      credentialAuthority: context.internalAdapter,
      password: context.password,
      sessionAdapter: context.adapter,
      userId: input.currentSession.userId,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      currentSession: input.currentSession,
      rotatedToken: input.rotatedToken,
      now: input.now,
      cookieResponse: authoritativeCookieResponse(
        input.rotatedToken,
        Math.floor((Math.min(
          input.now.getTime() + SESSION_INACTIVITY_MS,
          input.currentSession.authenticatedAt.getTime() + SESSION_ABSOLUTE_MS,
        ) - input.now.getTime()) / 1_000),
      ),
    }),
  });
}

function failSessionCreate(rawTx: TransactionClient): TransactionClient {
  if (!isH5TransactionClient(rawTx)) throw new Error("STOP_H5_TRANSACTION_CLIENT_INVALID");
  const sessionDelegate = rawTx.authProviderSession;
  const throwingDelegate = new Proxy(sessionDelegate, {
    get(target, property, receiver) {
      if (property === "create") {
        return async () => { throw new Error("INJECTED_H5_SESSION_CREATE_FAILURE"); };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return new Proxy(rawTx, {
    get(target, property, receiver) {
      return property === "authProviderSession" ? throwingDelegate : Reflect.get(target, property, receiver);
    },
  });
}

const ZERO_DELTAS: RowCounts = {
  providerUser: 0,
  providerAccount: 0,
  providerSession: 0,
  providerVerification: 0,
  canonicalUser: 0,
  authIdentity: 0,
  activation: 0,
  credentialToken: 0,
  abuseBucket: 0,
};

function authoritativeCookieResponse(value: string, maxAgeSeconds: number): Response {
  return new Response(null, { headers: {
    "set-cookie": `__Host-proof=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`,
  } });
}

function sessionAt(input: {
  readonly authenticatedAt: Date;
  readonly lastRefreshAt?: Date;
  readonly expiresAt?: Date;
  readonly token?: string;
}): SessionProofRecord {
  const lastRefreshAt = input.lastRefreshAt ?? input.authenticatedAt;
  return {
    id: "session-id",
    userId: "provider-user-id",
    token: input.token ?? "old-session-token",
    expiresAt: input.expiresAt ?? new Date(lastRefreshAt.getTime() + SESSION_INACTIVITY_MS),
    authenticatedAt: input.authenticatedAt,
    lastRefreshAt,
    selectedOrganizationId: "selected-organization-id",
  };
}

function comparable(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function guardedSessionIncrementAdapter(initial: SessionProofRecord): {
  readonly adapter: Pick<DBAdapter, "incrementOne">;
  readonly calls: Readonly<Record<string, unknown>>[];
  readonly read: () => SessionProofRecord;
} {
  let stored = initial;
  const calls: Readonly<Record<string, unknown>>[] = [];
  return {
    calls,
    read: () => stored,
    adapter: {
      incrementOne: async <T>(
        input: Parameters<DBAdapter["incrementOne"]>[0],
      ): Promise<T | null> => {
        await Promise.resolve();
        calls.push(input);
        if (input.model !== "session" || Object.keys(input.increment).length !== 0 || !input.set) {
          throw new Error("STOP_H5_GUARDED_ADAPTER_CALL_INVALID");
        }
        const matches = input.where.every((condition) => {
          const actual = comparable(Reflect.get(stored, condition.field));
          const expected = comparable(condition.value);
          if (condition.operator === "eq") return actual === expected;
          if (condition.operator === "gt") {
            return typeof actual === "number" && typeof expected === "number" && actual > expected;
          }
          throw new Error("STOP_H5_GUARDED_ADAPTER_OPERATOR_INVALID");
        });
        if (!matches) return null;
        stored = proofSession({ ...stored, ...input.set });
        return stored as unknown as T;
      },
    },
  };
}

test("H5 manifest records every required session case while runtime remains unexecuted", () => {
  assert.equal(H5_SESSION_BOUNDARY_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.deepEqual(SESSION_PROOF_CASES, [
    "INVALID_EMAIL",
    "INVALID_PASSWORD",
    "UNVERIFIED_EMAIL",
    "VALID_VERIFIED_SIGN_IN",
    "SESSION_CREATE_FAILURE",
    "FAILURE_AFTER_SESSION_WRITE",
    "FAILURE_BEFORE_COMMIT",
    "AFTER_COMMIT_DELIVERY_FAILURE",
    "REFRESH_ROTATION_24_HOURS",
    "INACTIVITY_EXPIRY_7_DAYS",
    "ABSOLUTE_EXPIRY_30_DAYS",
    "REVOKE_ALL",
    "AUTHENTICATED_PASSWORD_CHANGE",
  ]);
  assert.deepEqual(NATIVE_SESSION_BEHAVIORS, [
    {
      id: "SIGN_IN_SESSION_CREATE",
      accepted: true,
      source: "sign-in.mjs:353-361",
      behavior: "createSession then setSessionCookie",
    },
    {
      id: "SAME_TOKEN_REFRESH",
      accepted: false,
      source: "session.mjs:171-207",
      behavior: "retains token",
    },
    {
      id: "PASSWORD_CHANGE_REPLACEMENT",
      accepted: false,
      source: "update-user.mjs:180-189",
      behavior: "deletes and recreates session",
    },
  ]);
});

test("server-owned anchors use one instant and expose no client override input", () => {
  const serverInstant = new Date("2026-08-21T10:00:00.000Z");
  const hostile = new Date("1999-01-01T00:00:00.000Z");
  const anchors = serverOwnedSessionAnchors(serverInstant, {
    authenticatedAt: hostile,
    lastRefreshAt: hostile,
    selectedOrganizationId: "attacker-selected-organization",
  });
  assert.equal(anchors.authenticatedAt, serverInstant);
  assert.equal(anchors.lastRefreshAt, serverInstant);
  assert.equal(Object.keys(anchors).length, 2);
});

test("AFTER_SESSION_WRITE and BEFORE_COMMIT surround a real canonical or support stage", async () => {
  for (const failurePoint of ["AFTER_SESSION_WRITE", "BEFORE_COMMIT"] as const) {
    const stages: string[] = [];
    await assert.rejects(() => runSessionCommitStages({
      sessionWrite: async () => { stages.push("SESSION_WRITE"); return true; },
      canonicalOrSupportWrite: async () => { stages.push("CANONICAL_OR_SUPPORT_WRITE"); },
      failurePoint,
    }), new RegExp(`INJECTED_FAILURE_${failurePoint}`));
    assert.deepEqual(stages, failurePoint === "AFTER_SESSION_WRITE"
      ? ["SESSION_WRITE"]
      : ["SESSION_WRITE", "CANONICAL_OR_SUPPORT_WRITE"]);
  }
});

test("session policy rotates at 24 hours and caps expiry without resetting anchors", () => {
  const authenticatedAt = new Date("2026-08-01T00:00:00.000Z");
  const lastRefreshAt = new Date("2026-08-20T00:00:00.000Z");
  const session = sessionAt({ authenticatedAt, lastRefreshAt });
  const now = new Date(lastRefreshAt.getTime() + SESSION_REFRESH_MS);
  const decision = evaluateSessionPolicy(session, now);
  assert.equal(decision.action, "ROTATE");
  if (decision.action !== "ROTATE") return;
  assert.equal(decision.authenticatedAt, authenticatedAt);
  assert.equal(decision.selectedOrganizationId, "selected-organization-id");
  assert.equal(decision.lastRefreshAt, now);
  assert.equal(decision.expiresAt.toISOString(), "2026-08-28T00:00:00.000Z");

  const nearAbsolute = sessionAt({
    authenticatedAt,
    lastRefreshAt: new Date("2026-08-29T00:00:00.000Z"),
    expiresAt: new Date("2026-08-31T00:00:00.000Z"),
  });
  const capped = evaluateSessionPolicy(nearAbsolute, new Date("2026-08-30T00:00:00.000Z"));
  assert.equal(capped.action, "ROTATE");
  if (capped.action === "ROTATE") {
    assert.equal(capped.expiresAt.toISOString(), "2026-08-31T00:00:00.000Z");
  }
});

test("session policy rejects exact inactivity, absolute, and stored-expiry deadlines", () => {
  const authenticatedAt = new Date("2026-08-01T00:00:00.000Z");
  const inactivitySession = sessionAt({
    authenticatedAt,
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
    expiresAt: new Date("2026-09-30T00:00:00.000Z"),
  });
  assert.deepEqual(
    evaluateSessionPolicy(
      inactivitySession,
      new Date(inactivitySession.lastRefreshAt.getTime() + SESSION_INACTIVITY_MS),
    ),
    { action: "REAUTHENTICATE", reason: "INACTIVITY_EXPIRED", deleteSession: true },
  );

  const absoluteSession = sessionAt({
    authenticatedAt,
    lastRefreshAt: new Date("2026-08-30T12:00:00.000Z"),
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  assert.deepEqual(
    evaluateSessionPolicy(
      absoluteSession,
      new Date(authenticatedAt.getTime() + SESSION_ABSOLUTE_MS),
    ),
    { action: "REAUTHENTICATE", reason: "ABSOLUTE_EXPIRED", deleteSession: true },
  );

  const storedExpiry = sessionAt({
    authenticatedAt,
    expiresAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  assert.deepEqual(
    evaluateSessionPolicy(storedExpiry, new Date("2026-08-02T00:00:00.000Z")),
    { action: "REAUTHENTICATE", reason: "SESSION_EXPIRED", deleteSession: true },
  );
});

test("captured direct response headers remain internal until commit and return a fresh response", async () => {
  let externalResponse: Response | undefined;
  const cookieHeader = ["set", "cookie"].join("-");
  const result = await runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      captureDirectResponseHeaders(new Response(null, {
        headers: {
          [cookieHeader]: "__Host-proof=opaque; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax",
        },
      }));
      assert.equal(externalResponse, undefined);
      return "signed-in";
    },
    failurePoint: "NONE",
    afterCommit: (_value, response) => {
      externalResponse = response;
    },
  });
  assert.equal(result.value, "signed-in");
  assert.equal(result.response, externalResponse);
  assert.equal(result.response === externalResponse, true);
  assert.equal(result.cookie.present, true);
  assert.equal(result.cookie.secure, true);
  assert.equal(result.cookie.httpOnly, true);
  assert.equal(result.cookie.sameSite, "lax");
  assert.equal(result.cookie.hostOnly, true);
  assert.equal(result.cookie.maxAgeSeconds, 604800);
  assert.match(result.response.headers.get(cookieHeader) ?? "", /HttpOnly; Secure; SameSite=Lax/);
});

test("all precommit failures discard captured cookies and cannot publish a response", async () => {
  const cookieHeader = ["set", "cookie"].join("-");
  for (const failurePoint of ["AFTER_SESSION_WRITE", "BEFORE_COMMIT"] as const) {
    let externalResponse: Response | undefined;
    await assert.rejects(
      () => runCapturedBoundaryAttempt({
        transactionalWork: async () => {
          captureDirectResponseHeaders(new Response(null, {
            headers: {
              [cookieHeader]: "__Host-proof=opaque; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax",
            },
          }));
          throw new Error(`INJECTED_${failurePoint}`);
        },
        failurePoint,
        afterCommit: (_value, response) => {
          externalResponse = response;
        },
      }),
      (error: unknown) => {
        assert.equal(error instanceof BoundaryAttemptFailed, true);
        if (!(error instanceof BoundaryAttemptFailed)) return false;
        return error.commitObserved === false
          && error.cookieEligible === false
          && error.capturedCookieDiscarded === true
          && error.reauthenticationRequired === true
          && error.automaticRetryAllowed === false;
      },
    );
    assert.equal(externalResponse, undefined);
  }
});

test("invalid email, invalid password, unverified email, and session-create failure expose no cookie", async () => {
  for (const namedCase of [
    "INVALID_EMAIL",
    "INVALID_PASSWORD",
    "UNVERIFIED_EMAIL",
    "SESSION_CREATE_FAILURE",
  ] as const) {
    let externalResponse: Response | undefined;
    await assert.rejects(() => runCapturedBoundaryAttempt({
      transactionalWork: async () => { throw new Error(namedCase); },
      failurePoint: "NONE",
      afterCommit: (_value, response) => { externalResponse = response; },
    }), (error: unknown) => error instanceof BoundaryAttemptFailed
      && !error.commitObserved
      && !error.cookieEligible
      && !error.capturedCookieDiscarded
      && error.reauthenticationRequired);
    assert.equal(externalResponse, undefined);
  }
});

test("after-commit delivery failure returns no cookie, requires reauthentication, and never retries", async () => {
  const cookieHeader = ["set", "cookie"].join("-");
  let attempts = 0;
  await assert.rejects(
    () => runBoundaryWithRetry({
      attempt: async () => {
        attempts += 1;
        return runCapturedBoundaryAttempt({
          transactionalWork: async () => {
            captureDirectResponseHeaders(new Response(null, {
              headers: {
                [cookieHeader]: "__Host-proof=opaque; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax",
              },
            }));
            return "committed-session";
          },
          failurePoint: "NONE",
          afterCommit: () => {
            throw new Error("DELIVERY_FAILED");
          },
        });
      },
      auditFailure: async () => ({ finalRowDeltas: { ...ZERO_DELTAS, providerSession: 1 } }),
    }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal(Reflect.get(error as object, "reason"), "COMMIT_OBSERVED");
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test("invalid deferred cookie attributes fail closed after commit", async () => {
  const cookieHeader = ["set", "cookie"].join("-");
  await assert.rejects(
    () => runCapturedBoundaryAttempt({
      transactionalWork: async () => {
        captureDirectResponseHeaders(new Response(null, {
          headers: { [cookieHeader]: "proof=opaque; Domain=invalid.example; SameSite=None" },
        }));
        return "committed-session";
      },
      failurePoint: "NONE",
    }),
    (error: unknown) => {
      assert.equal(error instanceof BoundaryAttemptFailed, true);
      if (!(error instanceof BoundaryAttemptFailed)) return false;
      return error.commitObserved === true
        && error.reauthenticationRequired === true
        && error.automaticRetryAllowed === false;
    },
  );

});

test("pinned public adapter supports an upgrade-sensitive atomic session rotation", () => {
  assert.deepEqual(H5_SESSION_ROTATION_FEASIBILITY, {
    accepted: true,
    verdict: "SUPPORTED_STATIC",
    operation: "DBAdapter.incrementOne",
    callShape: "incrementOne({ model, where, increment: {}, set })",
    pinnedPublicAdapter: "@better-auth/core@1.7.1 DBAdapter",
    upgradeSensitive: true,
  });
});

test("atomic rotation makes the exact pinned public adapter call and preserves anchors", async () => {
  const now = new Date("2026-08-21T00:00:00.000Z");
  const current = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  const calls: Readonly<Record<string, unknown>>[] = [];
  const adapter: Pick<DBAdapter, "incrementOne"> = {
    incrementOne: async <T>(input: Parameters<DBAdapter["incrementOne"]>[0]): Promise<T | null> => {
      calls.push(input);
      return {
        ...current,
        token: "rotated_session_token_1234",
        expiresAt: new Date("2026-08-28T00:00:00.000Z"),
        lastRefreshAt: now,
      } as T;
    },
  };
  const rotated = await rotateSessionWithBetterAuthAuthority(adapter, {
    currentSession: current,
    presentedToken: current.token,
    rotatedToken: "rotated_session_token_1234",
    now,
  });
  assert.equal(rotated?.authenticatedAt, current.authenticatedAt);
  assert.equal(rotated?.selectedOrganizationId, current.selectedOrganizationId);
  assert.deepEqual(calls, [{
    model: "session",
    increment: {},
    set: {
      token: "rotated_session_token_1234",
      expiresAt: new Date("2026-08-28T00:00:00.000Z"),
      lastRefreshAt: now,
    },
    where: requiredAtomicRotationGuards({
      sessionId: current.id,
      presentedToken: current.token,
      now,
    }),
  }]);
});

test("atomic rotation invokes the database guard and returns null when its stored token is stale", async () => {
  const callerSnapshot = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    token: "presented-token",
  });
  const stored = { ...callerSnapshot, token: "newer-database-token" };
  assert.equal(
    evaluateSessionPolicy(callerSnapshot, new Date("2026-08-21T00:00:00.000Z")).action,
    "ROTATE",
  );
  const guarded = guardedSessionIncrementAdapter(stored);
  const before = guarded.read();
  const result = await runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      const rotated = await rotateSessionWithBetterAuthAuthority(guarded.adapter, {
        currentSession: callerSnapshot,
        presentedToken: callerSnapshot.token,
        rotatedToken: "rotated_session_token_1234",
        now: new Date("2026-08-21T00:00:00.000Z"),
      });
      if (rotated) {
        stageRotatedSessionCookie({
          token: rotated.token,
          response: authoritativeCookieResponse(rotated.token, 604800),
          now: rotated.lastRefreshAt,
          expiresAt: rotated.expiresAt,
          authenticatedAt: rotated.authenticatedAt,
          lastRefreshAt: rotated.lastRefreshAt,
        });
      }
      return rotated;
    },
    failurePoint: "NONE",
  });
  assert.equal(result.value, null);
  assert.equal(result.cookie.present, false);
  assert.equal(guarded.calls.length, 1);
  assert.deepEqual(guarded.calls[0]?.where, requiredAtomicRotationGuards({
    sessionId: callerSnapshot.id,
    presentedToken: callerSnapshot.token,
    now: new Date("2026-08-21T00:00:00.000Z"),
  }));
  assert.deepEqual(guarded.read(), before);
});

test("atomic rotation invokes every exact-deadline database guard and preserves stored state", async () => {
  const now = new Date("2026-08-21T00:00:00.000Z");
  const guards = requiredAtomicRotationGuards({ sessionId: "session-id", presentedToken: "token", now });
  assert.deepEqual(guards, [
    { field: "id", operator: "eq", value: "session-id" },
    { field: "token", operator: "eq", value: "token" },
    { field: "expiresAt", operator: "gt", value: now },
    { field: "lastRefreshAt", operator: "gt", value: new Date(now.getTime() - SESSION_INACTIVITY_MS) },
    { field: "authenticatedAt", operator: "gt", value: new Date(now.getTime() - SESSION_ABSOLUTE_MS) },
  ]);
  const callerSnapshot = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    token: "token",
  });
  assert.equal(evaluateSessionPolicy(callerSnapshot, now).action, "ROTATE");
  for (const [deadline, stored] of [
    ["EXPIRY", { ...callerSnapshot, expiresAt: now }],
    ["INACTIVITY", {
      ...callerSnapshot,
      lastRefreshAt: new Date(now.getTime() - SESSION_INACTIVITY_MS),
    }],
    ["ABSOLUTE", {
      ...callerSnapshot,
      authenticatedAt: new Date(now.getTime() - SESSION_ABSOLUTE_MS),
    }],
  ] as const) {
    const guarded = guardedSessionIncrementAdapter(stored);
    const before = guarded.read();
    const result = await runCapturedBoundaryAttempt({
      transactionalWork: async () => {
        const rotated = await rotateSessionWithBetterAuthAuthority(guarded.adapter, {
          currentSession: callerSnapshot,
          presentedToken: callerSnapshot.token,
          rotatedToken: `rotated_${deadline.toLowerCase()}_token_1234`,
          now,
        });
        if (rotated) {
          stageRotatedSessionCookie({
            token: rotated.token,
            response: authoritativeCookieResponse(rotated.token, 604800),
            now,
            expiresAt: rotated.expiresAt,
            authenticatedAt: rotated.authenticatedAt,
            lastRefreshAt: rotated.lastRefreshAt,
          });
        }
        return rotated;
      },
      failurePoint: "NONE",
    });
    assert.equal(result.value, null, deadline);
    assert.equal(result.cookie.present, false, deadline);
    assert.equal(guarded.calls.length, 1, deadline);
    assert.deepEqual(guarded.calls[0]?.where, guards, deadline);
    assert.deepEqual(guarded.read(), before, deadline);
  }
});

test("concurrent atomic rotations have exactly one winner", async () => {
  const current = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  const guarded = guardedSessionIncrementAdapter(current);
  const now = new Date("2026-08-21T00:00:00.000Z");
  const attempts = await Promise.all([
    rotateSessionWithBetterAuthAuthority(guarded.adapter, {
      currentSession: current, presentedToken: current.token,
      rotatedToken: "rotated_session_token_1111", now,
    }),
    rotateSessionWithBetterAuthAuthority(guarded.adapter, {
      currentSession: current, presentedToken: current.token,
      rotatedToken: "rotated_session_token_2222", now,
    }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt !== null).length, 1);
  assert.equal(attempts.filter((attempt) => attempt === null).length, 1);
  assert.equal(guarded.calls.length, 2);
});

test("rotated cookie is deferred and capped by inactivity and absolute limits", async () => {
  const now = new Date("2026-08-21T00:00:00.000Z");
  const authenticatedAt = new Date("2026-08-01T00:00:00.000Z");
  const result = await runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      stageRotatedSessionCookie({
        token: "rotated_session_token_1234",
        response: authoritativeCookieResponse("rotated_session_token_1234", 604800),
        now,
        expiresAt: new Date("2026-09-30T00:00:00.000Z"),
        authenticatedAt,
        lastRefreshAt: now,
      });
      return true;
    },
    failurePoint: "NONE",
  });
  assert.equal(result.cookie.maxAgeSeconds, 604800);
  assert.equal(result.cookie.secure, true);
  assert.equal(result.cookie.httpOnly, true);
  assert.equal(result.cookie.sameSite, "lax");
  assert.equal(result.cookie.hostOnly, true);
  const nearAbsolute = await runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      stageRotatedSessionCookie({
        token: "absolute_capped_token_1234",
        response: authoritativeCookieResponse("absolute_capped_token_1234", 86400),
        now: new Date("2026-08-30T00:00:00.000Z"),
        expiresAt: new Date("2026-09-30T00:00:00.000Z"),
        authenticatedAt,
        lastRefreshAt: new Date("2026-08-30T00:00:00.000Z"),
      });
      return true;
    },
    failurePoint: "NONE",
  });
  assert.equal(nearAbsolute.cookie.maxAgeSeconds, 86400);
});

test("rotated cookie rollback emits none and delivery failure is never retried", async () => {
  for (const failurePoint of ["AFTER_SESSION_WRITE", "BEFORE_COMMIT"] as const) {
    await assert.rejects(() => runCapturedBoundaryAttempt({
      transactionalWork: async () => {
        stageRotatedSessionCookie({
          token: "rotated_session_token_1234",
          response: authoritativeCookieResponse("rotated_session_token_1234", 604800),
          now: new Date("2026-08-21T00:00:00.000Z"),
          expiresAt: new Date("2026-08-28T00:00:00.000Z"),
          authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
          lastRefreshAt: new Date("2026-08-21T00:00:00.000Z"),
        });
        throw new Error(failurePoint);
      },
      failurePoint,
    }), (error: unknown) => error instanceof BoundaryAttemptFailed
      && error.capturedCookieDiscarded
      && !error.cookieEligible);
  }
  let attempts = 0;
  await assert.rejects(() => runBoundaryWithRetry({
    attempt: async () => {
      attempts += 1;
      return runCapturedBoundaryAttempt({
        transactionalWork: async () => {
          stageRotatedSessionCookie({
            token: "rotated_session_token_1234",
            response: authoritativeCookieResponse("rotated_session_token_1234", 604800),
            now: new Date("2026-08-21T00:00:00.000Z"),
            expiresAt: new Date("2026-08-28T00:00:00.000Z"),
            authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
            lastRefreshAt: new Date("2026-08-21T00:00:00.000Z"),
          });
          return true;
        },
        failurePoint: "NONE",
        afterCommit: () => { throw new Error("DELIVERY_FAILED"); },
      });
    },
    auditFailure: async () => ({ finalRowDeltas: { ...ZERO_DELTAS, providerSession: 1 } }),
  }), (error: unknown) => Reflect.get(error as object, "reason") === "COMMIT_OBSERVED");
  assert.equal(attempts, 1);
});

test("expiry and revoke-all use public adapter operations and publish an expiring cookie only after commit", async () => {
  const calls: Readonly<Record<string, unknown>>[] = [];
  const adapter: Pick<DBAdapter, "delete" | "deleteMany"> = {
    delete: async (input) => { calls.push(input); },
    deleteMany: async (input) => { calls.push(input); return 1; },
  };
  const expired = await runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      await expireSessionWithBetterAuthAuthority(
        adapter,
        "session-id",
        "presented-token",
        authoritativeCookieResponse("", 0),
      );
      return true;
    },
    failurePoint: "NONE",
  });
  assert.equal(expired.cookie.maxAgeSeconds, 0);
  const revoked = await runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      await revokeAllWithBetterAuthAuthority(adapter, "provider-user-id", authoritativeCookieResponse("", 0));
      return true;
    },
    failurePoint: "NONE",
  });
  assert.equal(revoked.cookie.maxAgeSeconds, 0);
  assert.equal(revoked.cookie.hostOnly, true);
  assert.deepEqual(calls.map((call) => call.model), ["session", "session"]);

  await assert.rejects(() => runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      await revokeAllWithBetterAuthAuthority(adapter, "rollback-user-id", authoritativeCookieResponse("", 0));
      throw new Error("ROLLBACK");
    },
    failurePoint: "NONE",
  }), (error: unknown) => error instanceof BoundaryAttemptFailed
    && error.capturedCookieDiscarded
    && !error.cookieEligible);
});

test("expiry and revoke delivery failures are never retried", async () => {
  for (const operation of ["EXPIRE", "REVOKE_ALL"] as const) {
    let attempts = 0;
    const adapter: Pick<DBAdapter, "delete" | "deleteMany"> = {
      delete: async () => {},
      deleteMany: async () => 1,
    };
    await assert.rejects(() => runBoundaryWithRetry({
      attempt: async () => {
        attempts += 1;
        return runCapturedBoundaryAttempt({
          transactionalWork: async () => {
            if (operation === "EXPIRE") {
              await expireSessionWithBetterAuthAuthority(
                adapter, "session-id", "token", authoritativeCookieResponse("", 0),
              );
            } else {
              await revokeAllWithBetterAuthAuthority(
                adapter, "user-id", authoritativeCookieResponse("", 0),
              );
            }
            return operation;
          },
          failurePoint: "NONE",
          afterCommit: () => { throw new Error("DELIVERY_FAILED"); },
        });
      },
      auditFailure: async () => ({ finalRowDeltas: { ...ZERO_DELTAS, providerSession: -1 } }),
    }), (error: unknown) => Reflect.get(error as object, "reason") === "COMMIT_OBSERVED");
    assert.equal(attempts, 1);
  }
});

test("authenticated password change uses Better Auth authority and atomically rotates the current session", async () => {
  const current = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  const calls: string[] = [];
  const result = await runCapturedBoundaryAttempt({
    transactionalWork: () => changePasswordWithBetterAuthAuthority({
      credentialAuthority: {
        findCredentialAccount: async () => {
          calls.push("FIND_CREDENTIAL_ACCOUNT");
          return { id: "account-id", password: "current-hash" };
        },
        updateAccount: async (_id, data) => {
          calls.push(`UPDATE_ACCOUNT:${data.password}`);
        },
      },
      password: {
        verify: async () => { calls.push("VERIFY_CURRENT_PASSWORD"); return true; },
        hash: async () => { calls.push("HASH_NEW_PASSWORD"); return "new-hash"; },
      },
      sessionAdapter: {
        deleteMany: async (input) => { calls.push(`DELETE_OTHER_SESSIONS:${input.where.length}`); return 2; },
        incrementOne: async <T>(input: Parameters<DBAdapter["incrementOne"]>[0]): Promise<T | null> => {
          calls.push("ATOMIC_ROTATE_CURRENT_SESSION");
          return { ...current, ...input.set } as T;
        },
      },
      userId: current.userId,
      currentPassword: "current-password",
      newPassword: "new-password",
      currentSession: current,
      rotatedToken: "rotated_session_token_1234",
      now: new Date("2026-08-21T00:00:00.000Z"),
      cookieResponse: authoritativeCookieResponse("rotated_session_token_1234", 604800),
    }),
    failurePoint: "NONE",
  });
  assert.deepEqual(calls, [
    "FIND_CREDENTIAL_ACCOUNT",
    "VERIFY_CURRENT_PASSWORD",
    "HASH_NEW_PASSWORD",
    "UPDATE_ACCOUNT:new-hash",
    "DELETE_OTHER_SESSIONS:2",
    "ATOMIC_ROTATE_CURRENT_SESSION",
  ]);
  assert.equal(result.value.authenticatedAt, current.authenticatedAt);
  assert.equal(result.value.selectedOrganizationId, current.selectedOrganizationId);
  assert.equal(result.cookie.secure, true);
  assert.equal(result.cookie.httpOnly, true);
  assert.equal(result.cookie.sameSite, "lax");
  assert.equal(result.cookie.hostOnly, true);
});

test("authenticated password change rejects an invalid current password before mutation or cookie staging", async () => {
  const current = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  const calls: string[] = [];
  let externalResponse: Response | undefined;
  await assert.rejects(() => runCapturedBoundaryAttempt({
    transactionalWork: () => changePasswordWithBetterAuthAuthority({
      credentialAuthority: {
        findCredentialAccount: async () => {
          calls.push("FIND_CREDENTIAL_ACCOUNT");
          return { id: "account-id", password: "current-hash" };
        },
        updateAccount: async () => { throw new Error("UNEXPECTED_ACCOUNT_UPDATE"); },
      },
      password: {
        verify: async () => { calls.push("VERIFY_CURRENT_PASSWORD"); return false; },
        hash: async () => { throw new Error("UNEXPECTED_PASSWORD_HASH"); },
      },
      sessionAdapter: {
        deleteMany: async () => { throw new Error("UNEXPECTED_SESSION_DELETE"); },
        incrementOne: async <T>(): Promise<T | null> => { throw new Error("UNEXPECTED_SESSION_ROTATION"); },
      },
      userId: current.userId,
      currentPassword: "invalid-current-password",
      newPassword: "new-password",
      currentSession: current,
      rotatedToken: "rotated_session_token_1234",
      now: new Date("2026-08-21T00:00:00.000Z"),
      cookieResponse: authoritativeCookieResponse("rotated_session_token_1234", 604800),
    }),
    failurePoint: "NONE",
    afterCommit: (_value, response) => { externalResponse = response; },
  }), (error: unknown) => error instanceof BoundaryAttemptFailed
    && !error.commitObserved
    && !error.cookieEligible
    && !error.capturedCookieDiscarded);
  assert.deepEqual(calls, ["FIND_CREDENTIAL_ACCOUNT", "VERIFY_CURRENT_PASSWORD"]);
  assert.equal(externalResponse, undefined);
});

test("live H5 uses controlled activation and exercises sign-in, rotation, and password-change boundaries", {
  skip: process.env.PASSVERO_PROOF_H5 !== "1",
}, async () => {
  const generatedPath = "../generated/client/client.js";
  const generated: unknown = await import(generatedPath);
  const adapter = new PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) });
  const prisma = createGeneratedPrismaClient(generated, adapter);
  try {
    const unverifiedLabel = fixtureLabel();
    const unverifiedEmail = `h5-unverified-${unverifiedLabel}@invalid.example`;
    const unverifiedPassword = `H5-${unverifiedLabel}-Aa1!`;
    await createCredential(prisma, {
      email: unverifiedEmail,
      password: unverifiedPassword,
      verified: false,
    });
    const beforeUnverified = await providerSessionCount(prisma);
    let unverifiedExternalResponse: Response | undefined;
    await assert.rejects(() => signIn(prisma, {
      email: unverifiedEmail,
      password: unverifiedPassword,
      afterCommit: (_value, response) => { unverifiedExternalResponse = response; },
    }), (error: unknown) => error instanceof BoundaryAttemptFailed
      && !error.commitObserved
      && !error.cookieEligible
      && !error.capturedCookieDiscarded);
    assert.equal(await providerSessionCount(prisma), beforeUnverified);
    assert.equal(unverifiedExternalResponse, undefined);

    const validLabel = fixtureLabel();
    const email = `h5-valid-${validLabel}@invalid.example`;
    const password = `H5-${validLabel}-Aa1!`;
    const userId = await createCredential(prisma, { email, password, verified: true });
    for (const rejected of [
      { email: `missing-${fixtureLabel()}@invalid.example`, password },
      { email, password: `${password}-wrong` },
    ]) {
      const before = await providerSessionCount(prisma);
      let rejectedExternalResponse: Response | undefined;
      await assert.rejects(() => signIn(prisma, {
        ...rejected,
        afterCommit: (_value, response) => { rejectedExternalResponse = response; },
      }), (error: unknown) => error instanceof BoundaryAttemptFailed
        && !error.commitObserved
        && !error.cookieEligible
        && !error.capturedCookieDiscarded);
      assert.equal(await providerSessionCount(prisma), before);
      assert.equal(rejectedExternalResponse, undefined);
    }

    const beforeValid = await providerSessionCount(prisma);
    const hostileAnchor = new Date("1999-01-01T00:00:00.000Z");
    const valid = await signIn(prisma, {
      email,
      password,
      hostileSessionAnchors: {
        authenticatedAt: hostileAnchor,
        lastRefreshAt: hostileAnchor,
        selectedOrganizationId: "attacker-selected-organization",
      },
    });
    assert.equal(await providerSessionCount(prisma), beforeValid + 1);
    assert.equal(valid.value.providerUserId, userId);
    assert.equal(valid.cookie.present, true);
    assert.equal(valid.cookie.secure, true);
    assert.equal(valid.cookie.httpOnly, true);
    assert.equal(valid.cookie.sameSite, "lax");
    assert.equal(valid.cookie.hostOnly, true);
    const createdSession = await sessionByToken(prisma, valid.value.token);
    assert.equal(createdSession.authenticatedAt.getTime(), createdSession.lastRefreshAt.getTime());
    assert.notEqual(createdSession.authenticatedAt.getTime(), hostileAnchor.getTime());
    assert.equal(createdSession.selectedOrganizationId, null);

    const beforeCreateFailure = await providerSessionCount(prisma);
    let createFailureExternalResponse: Response | undefined;
    await assert.rejects(() => signIn(prisma, {
      email,
      password,
      bindTransactionClient: failSessionCreate,
      afterCommit: (_value, response) => { createFailureExternalResponse = response; },
    }), (error: unknown) => error instanceof BoundaryAttemptFailed
      && !error.commitObserved
      && !error.cookieEligible
      && !error.capturedCookieDiscarded);
    assert.equal(await providerSessionCount(prisma), beforeCreateFailure);
    assert.equal(createFailureExternalResponse, undefined);

    for (const failurePoint of ["AFTER_SESSION_WRITE", "BEFORE_COMMIT"] as const) {
      const before = await providerSessionCount(prisma);
      let externalResponse: Response | undefined;
      await assert.rejects(
        () => signIn(prisma, {
          email,
          password,
          failurePoint,
          beforeCommitStage: async (tx) => {
            if (!isH5TransactionClient(tx)) throw new Error("STOP_H5_TRANSACTION_CLIENT_INVALID");
            const now = new Date();
            await tx.authAbuseBucket.create({ data: {
              dimension: "ACCOUNT_IDENTIFIER",
              keyDigest: randomBytes(32).toString("base64url"),
              attemptCount: 1,
              failureCount: 0,
              backoffLevel: 0,
              windowStartedAt: now,
              backoffUpdatedAt: now,
              expiresAt: new Date(now.getTime() + 60_000),
            } });
          },
          afterCommit: (_value, response) => { externalResponse = response; },
        }),
        (error: unknown) => error instanceof BoundaryAttemptFailed
          && !error.commitObserved
          && !error.cookieEligible
          && error.capturedCookieDiscarded,
      );
      assert.equal(await providerSessionCount(prisma), before);
      assert.equal(externalResponse, undefined);
    }

    const beforeDeliveryFailure = await providerSessionCount(prisma);
    let externalResponse: Response | undefined;
    await assert.rejects(
      async () => {
        const delivered = await signIn(prisma, {
          email,
          password,
          afterCommit: () => { throw new Error("INJECTED_H5_DELIVERY_FAILURE"); },
        });
        externalResponse = delivered.response;
      },
      (error: unknown) => error instanceof BoundaryAttemptFailed
        && error.commitObserved
        && error.reauthenticationRequired
        && !error.automaticRetryAllowed,
    );
    assert.equal(externalResponse, undefined);
    assert.equal(await providerSessionCount(prisma), beforeDeliveryFailure + 1);

    const refreshToken = randomBytes(32).toString("base64url");
    const refreshNow = new Date(createdSession.lastRefreshAt.getTime() + SESSION_REFRESH_MS);
    const refreshed = await rotateSession(prisma, {
      currentSession: createdSession,
      presentedToken: createdSession.token,
      rotatedToken: refreshToken,
      now: refreshNow,
    });
    assert.ok(refreshed.value);
    assert.equal(refreshed.cookie.present, true);
    assert.equal(refreshed.cookie.secure, true);
    assert.equal(refreshed.cookie.httpOnly, true);
    assert.equal(refreshed.cookie.sameSite, "lax");
    assert.equal(refreshed.cookie.hostOnly, true);
    assert.equal(refreshed.value?.authenticatedAt.getTime(), createdSession.authenticatedAt.getTime());
    assert.equal(refreshed.value?.selectedOrganizationId, createdSession.selectedOrganizationId);

    const staleStoredBefore = await sessionByToken(prisma, refreshToken);
    const staleCountBefore = await providerSessionCount(prisma, userId);
    assert.equal(evaluateSessionPolicy(createdSession, refreshNow).action, "ROTATE");
    const staleGuardLoss = await rotateSession(prisma, {
      currentSession: createdSession,
      presentedToken: createdSession.token,
      rotatedToken: randomBytes(32).toString("base64url"),
      now: refreshNow,
    });
    assert.equal(staleGuardLoss.value, null);
    assert.equal(staleGuardLoss.cookie.present, false);
    assert.equal(await providerSessionCount(prisma, userId), staleCountBefore);
    assert.deepEqual(await sessionByToken(prisma, refreshToken), staleStoredBefore);

    for (const deadline of ["EXPIRY", "INACTIVITY", "ABSOLUTE"] as const) {
      const deadlineSignIn = await signIn(prisma, { email, password });
      const callerSnapshot = await sessionByToken(prisma, deadlineSignIn.value.token);
      const deadlineNow = new Date(callerSnapshot.lastRefreshAt.getTime() + SESSION_REFRESH_MS);
      assert.equal(evaluateSessionPolicy(callerSnapshot, deadlineNow).action, "ROTATE", deadline);
      const fixtureUpdate = deadline === "EXPIRY"
        ? { expiresAt: deadlineNow }
        : deadline === "INACTIVITY"
          ? {
              lastRefreshAt: new Date(deadlineNow.getTime() - SESSION_INACTIVITY_MS),
              expiresAt: new Date(deadlineNow.getTime() + SESSION_REFRESH_MS),
            }
          : {
              authenticatedAt: new Date(deadlineNow.getTime() - SESSION_ABSOLUTE_MS),
              expiresAt: new Date(deadlineNow.getTime() + SESSION_REFRESH_MS),
            };
      const storedBefore = await updateStoredSessionFixture(prisma, callerSnapshot.id, fixtureUpdate);
      const countBefore = await providerSessionCount(prisma, userId);
      const guardLoss = await rotateSession(prisma, {
        currentSession: callerSnapshot,
        presentedToken: callerSnapshot.token,
        rotatedToken: randomBytes(32).toString("base64url"),
        now: deadlineNow,
      });
      assert.equal(guardLoss.value, null, deadline);
      assert.equal(guardLoss.cookie.present, false, deadline);
      assert.equal(await providerSessionCount(prisma, userId), countBefore, deadline);
      assert.deepEqual(await sessionByToken(prisma, callerSnapshot.token), storedBefore, deadline);
    }

    const concurrencySeedSignIn = await signIn(prisma, { email, password });
    const concurrencySeed = await sessionByToken(prisma, concurrencySeedSignIn.value.token);
    const concurrencyNow = new Date(concurrencySeed.lastRefreshAt.getTime() + SESSION_REFRESH_MS);
    const concurrent = await Promise.all([
      rotateSession(prisma, {
        currentSession: concurrencySeed,
        presentedToken: concurrencySeed.token,
        rotatedToken: randomBytes(32).toString("base64url"),
        now: concurrencyNow,
      }),
      rotateSession(prisma, {
        currentSession: concurrencySeed,
        presentedToken: concurrencySeed.token,
        rotatedToken: randomBytes(32).toString("base64url"),
        now: concurrencyNow,
      }),
    ]);
    const concurrencyWinners = concurrent.filter((attempt) => attempt.value !== null);
    assert.equal(concurrencyWinners.length, 1);
    assert.equal(concurrent.filter((attempt) => attempt.value === null).length, 1);
    const passwordSession = concurrencyWinners[0]?.value;
    if (!passwordSession) throw new Error("STOP_H5_CONCURRENT_ROTATION_WINNER_MISSING");

    const newPassword = `H5-new-${fixtureLabel()}-Aa1!`;
    const changed = await changePassword(prisma, {
      currentPassword: password,
      newPassword,
      currentSession: passwordSession,
      rotatedToken: randomBytes(32).toString("base64url"),
      now: new Date(passwordSession.lastRefreshAt.getTime() + 1),
    });
    assert.equal(changed.value.authenticatedAt.getTime(), passwordSession.authenticatedAt.getTime());
    assert.equal(changed.value.selectedOrganizationId, passwordSession.selectedOrganizationId);
    assert.equal(changed.cookie.present, true);
    assert.equal(changed.cookie.secure, true);
    assert.equal(changed.cookie.httpOnly, true);
    assert.equal(changed.cookie.sameSite, "lax");
    assert.equal(changed.cookie.hostOnly, true);
    assert.equal(await providerSessionCount(prisma, userId), 1);
    await assert.rejects(() => signIn(prisma, { email, password }));
    const newPasswordSignIn = await signIn(prisma, { email, password: newPassword });
    assert.equal(newPasswordSignIn.value.providerUserId, userId);

    assert.equal(H5_SESSION_ROTATION_FEASIBILITY.verdict, "SUPPORTED_STATIC");
    console.log("H5_SESSION_BOUNDARY=NOT_EXECUTED");
  } finally {
    await prisma.$disconnect();
  }
});
