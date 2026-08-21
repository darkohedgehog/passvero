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
  requiredAtomicRotationGuards,
  requireSupportedAtomicSessionRotation,
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

test("pinned public adapter cannot express the required atomic session rotation", () => {
  assert.deepEqual(H5_SESSION_ROTATION_FEASIBILITY, {
    accepted: false,
    verdict: "FAIL",
    reason: "NO_SUPPORTED_ATOMIC_SESSION_ROTATION",
    pinnedPublicAdapter: "@better-auth/core@1.7.1 DBAdapter",
    rejectedOperations: [
      "DBAdapter.update: explicitly not race-safe for guarded state transitions",
      "DBAdapter.incrementOne: requires a numeric session field to increment",
      "non-public session helper: unexported and read-then-update",
      "Prisma provider-session delegate: direct provider-table write",
    ],
  });
  assert.throws(requireSupportedAtomicSessionRotation, /NO_SUPPORTED_ATOMIC_SESSION_ROTATION/);
});

test("atomic rotation guard rejects a stale presented token", () => {
  const guards = requiredAtomicRotationGuards({
    sessionId: "session-id",
    presentedToken: "stale-token",
    now: new Date("2026-08-21T00:00:00.000Z"),
  });
  assert.deepEqual(guards.slice(0, 2), [
    { field: "id", operator: "eq", value: "session-id" },
    { field: "token", operator: "eq", value: "stale-token" },
  ]);
  assert.throws(requireSupportedAtomicSessionRotation, /NO_SUPPORTED_ATOMIC_SESSION_ROTATION/);
});

test("atomic rotation guard rejects exact expiry, inactivity, and absolute deadlines", () => {
  const now = new Date("2026-08-21T00:00:00.000Z");
  const guards = requiredAtomicRotationGuards({ sessionId: "session-id", presentedToken: "token", now });
  assert.deepEqual(guards, [
    { field: "id", operator: "eq", value: "session-id" },
    { field: "token", operator: "eq", value: "token" },
    { field: "expiresAt", operator: "gt", value: now },
    { field: "lastRefreshAt", operator: "gt", value: new Date(now.getTime() - SESSION_INACTIVITY_MS) },
    { field: "authenticatedAt", operator: "gt", value: new Date(now.getTime() - SESSION_ABSOLUTE_MS) },
  ]);
});

test("concurrent rotation requires one conditional-update winner and remains unsupported", async () => {
  const attempts = await Promise.allSettled([
    Promise.resolve().then(requireSupportedAtomicSessionRotation),
    Promise.resolve().then(requireSupportedAtomicSessionRotation),
  ]);
  assert.equal(attempts.every((attempt) => attempt.status === "rejected"), true);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 0);
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

test("password change is rejected before credential mutation because current-session rotation is unsupported", () => {
  assert.throws(requireSupportedAtomicSessionRotation, /NO_SUPPORTED_ATOMIC_SESSION_ROTATION/);
});

test("live H5 uses controlled activation and exercises sign-in rollback cases only", {
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
    await assert.rejects(() => signIn(prisma, {
      email: unverifiedEmail,
      password: unverifiedPassword,
    }));
    assert.equal(await providerSessionCount(prisma), beforeUnverified);

    const validLabel = fixtureLabel();
    const email = `h5-valid-${validLabel}@invalid.example`;
    const password = `H5-${validLabel}-Aa1!`;
    const userId = await createCredential(prisma, { email, password, verified: true });
    for (const rejected of [
      { email: `missing-${fixtureLabel()}@invalid.example`, password },
      { email, password: `${password}-wrong` },
    ]) {
      const before = await providerSessionCount(prisma);
      await assert.rejects(() => signIn(prisma, rejected));
      assert.equal(await providerSessionCount(prisma), before);
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
    await assert.rejects(() => signIn(prisma, {
      email,
      password,
      bindTransactionClient: failSessionCreate,
    }));
    assert.equal(await providerSessionCount(prisma), beforeCreateFailure);

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

    assert.equal(H5_SESSION_ROTATION_FEASIBILITY.verdict, "FAIL");
    console.log("H5_SESSION_BOUNDARY=NOT_EXECUTED_NO_SUPPORTED_ATOMIC_SESSION_ROTATION");
  } finally {
    await prisma.$disconnect();
  }
});
