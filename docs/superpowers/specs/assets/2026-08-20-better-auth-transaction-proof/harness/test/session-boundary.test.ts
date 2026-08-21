import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  H5_SESSION_BOUNDARY_RUNTIME_VERDICT,
  NATIVE_SESSION_BEHAVIORS,
  SESSION_ABSOLUTE_MS,
  SESSION_INACTIVITY_MS,
  SESSION_PROOF_CASES,
  SESSION_REFRESH_MS,
  BoundaryAttemptFailed,
  captureDirectResponseHeaders,
  evaluateSessionPolicy,
  changePasswordWithBetterAuthAuthority,
  revokeAllWithBetterAuthAuthority,
  rotateSessionWithBetterAuthAuthority,
  runBoundaryWithRetry,
  runBetterAuthBoundary,
  runCapturedBoundaryAttempt,
  serverOwnedSessionAnchors,
  type SessionProofRecord,
  type SessionAuthoritativeOperations,
  type PasswordAuthoritativeOperations,
  type BoundaryRootPrisma,
  type TransactionClient,
} from "../src/proof-boundary.js";
import type { RowCounts } from "../src/evidence.js";
import { createProofAuth } from "../src/auth.js";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

type UnknownRecord = Record<PropertyKey, unknown>;

interface CountDelegate {
  count(input?: { readonly where?: Readonly<Record<string, unknown>> }): Promise<number>;
}

interface FindUniqueDelegate {
  findUnique(input: { readonly where: Readonly<Record<string, unknown>> }): Promise<unknown>;
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
  readonly authAbuseBucket: CountDelegate;
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
    invoke: async (api, rawTx) => {
      const response = await api.signUpEmail({
        body: { name: `proof-${fixtureLabel()}`, email: input.email, password: input.password },
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
        const auth = createProofAuth({ prisma: rawTx, adapterTransaction: false, disableSignUp: false });
        await (await auth.$context).internalAdapter.updateUser(userId, { emailVerified: true });
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
  },
) {
  return runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: input.failurePoint ?? "NONE",
    bindTransactionClient: input.bindTransactionClient,
    afterCommit: input.afterCommit,
    invoke: async (api) => {
      const response = await api.signInEmail({
        body: { email: input.email, password: input.password },
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

async function betterAuthAuthorities(tx: TransactionClient): Promise<{
  readonly session: SessionAuthoritativeOperations;
  readonly password: PasswordAuthoritativeOperations;
}> {
  const auth = createProofAuth({ prisma: tx, adapterTransaction: false, disableSignUp: false });
  const context = await auth.$context;
  return {
    session: {
      findSession: async (token) => {
        const found = await context.internalAdapter.findSession(token);
        return found ? { session: proofSession(found.session) } : null;
      },
      updateSession: async (token, data) => proofSession(
        await context.internalAdapter.updateSession(token, data),
      ),
      deleteSession: async (token) => { await context.internalAdapter.deleteSession(token); },
      deleteUserSessions: async (userId) => { await context.internalAdapter.deleteUserSessions(userId); },
      listSessions: async (userId) => (await context.internalAdapter.listSessions(userId)).map(proofSession),
      deleteSessions: async (tokens) => { await context.internalAdapter.deleteSessions([...tokens]); },
    },
    password: {
      minPasswordLength: context.password.config.minPasswordLength,
      maxPasswordLength: context.password.config.maxPasswordLength,
      findCredentialAccount: async (userId) => {
        const account = await context.internalAdapter.findCredentialAccount(userId);
        return account ? { id: account.id, password: account.password } : null;
      },
      verify: (input) => context.password.verify(input),
      hash: (password) => context.password.hash(password),
      updateAccount: async (id, data) => { await context.internalAdapter.updateAccount(id, data); },
    },
  };
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
  const anchors = serverOwnedSessionAnchors(serverInstant);
  assert.equal(anchors.authenticatedAt, serverInstant);
  assert.equal(anchors.lastRefreshAt, serverInstant);
  assert.equal(Object.keys(anchors).length, 2);
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

test("rotation uses the Better Auth authoritative session adapter and preserves both anchors and selection", async () => {
  const authenticatedAt = new Date("2026-08-01T00:00:00.000Z");
  const lastRefreshAt = new Date("2026-08-20T00:00:00.000Z");
  const session = sessionAt({ authenticatedAt, lastRefreshAt });
  const now = new Date(lastRefreshAt.getTime() + SESSION_REFRESH_MS);
  const updates: Array<{ readonly token: string; readonly data: Readonly<Record<string, unknown>> }> = [];
  const adapter: SessionAuthoritativeOperations = {
    findSession: async (token) => token === session.token ? { session } : null,
    updateSession: async (token, data) => {
      updates.push({ token, data });
      return { ...session, ...data } as SessionProofRecord;
    },
    deleteSession: async () => {},
    deleteUserSessions: async () => {},
    listSessions: async () => [session],
    deleteSessions: async () => {},
  };
  const result = await rotateSessionWithBetterAuthAuthority({
    internalAdapter: adapter,
    presentedToken: session.token,
    now,
    newToken: "new-session-token",
  });
  assert.equal(result.action, "ROTATED");
  assert.deepEqual(updates, [{
    token: "old-session-token",
    data: {
      token: "new-session-token",
      expiresAt: new Date("2026-08-28T00:00:00.000Z"),
      authenticatedAt,
      lastRefreshAt: now,
      selectedOrganizationId: "selected-organization-id",
      updatedAt: now,
    },
  }]);
});

test("expired session is deleted through Better Auth authority without rotation", async () => {
  const deleted: string[] = [];
  const session = sessionAt({
    authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
    expiresAt: new Date("2026-08-07T00:00:00.000Z"),
  });
  const adapter: SessionAuthoritativeOperations = {
    findSession: async (token) => token === session.token ? { session } : null,
    updateSession: async () => assert.fail("expired session must not update"),
    deleteSession: async (token) => { deleted.push(token); },
    deleteUserSessions: async () => {},
    listSessions: async () => [],
    deleteSessions: async () => {},
  };
  const result = await rotateSessionWithBetterAuthAuthority({
    internalAdapter: adapter,
    presentedToken: session.token,
    now: new Date("2026-08-07T00:00:00.000Z"),
    newToken: "must-not-be-used",
  });
  assert.deepEqual(result, { action: "REAUTHENTICATE", reason: "SESSION_EXPIRED" });
  assert.deepEqual(deleted, ["old-session-token"]);
});

test("revoke-all delegates to Better Auth authority for the provider user", async () => {
  const users: string[] = [];
  const adapter: SessionAuthoritativeOperations = {
    findSession: async () => null,
    updateSession: async () => null,
    deleteSession: async () => {},
    deleteUserSessions: async (userId) => { users.push(userId); },
    listSessions: async () => [],
    deleteSessions: async () => {},
  };
  await revokeAllWithBetterAuthAuthority(adapter, "provider-user-id");
  assert.deepEqual(users, ["provider-user-id"]);
});

test("password change verifies and updates through Better Auth, revokes others, and rotates current without resetting anchors", async () => {
  const authenticatedAt = new Date("2026-08-01T00:00:00.000Z");
  const lastRefreshAt = new Date("2026-08-20T00:00:00.000Z");
  const expiresAt = new Date("2026-08-27T00:00:00.000Z");
  const current = sessionAt({ authenticatedAt, lastRefreshAt, expiresAt });
  const other = { ...current, id: "other-id", token: "other-token" };
  const operations: string[] = [];
  const adapter: SessionAuthoritativeOperations = {
    findSession: async (token) => {
      operations.push(`find-session:${token}`);
      return token === current.token ? { session: current } : null;
    },
    updateSession: async (token, data) => {
      operations.push(`update-session:${token}`);
      return { ...current, ...data } as SessionProofRecord;
    },
    deleteSession: async () => {},
    deleteUserSessions: async () => {},
    listSessions: async (userId) => {
      operations.push(`list-sessions:${userId}`);
      return [current, other];
    },
    deleteSessions: async (tokens) => { operations.push(`delete-sessions:${tokens.join(",")}`); },
  };
  const password: PasswordAuthoritativeOperations = {
    minPasswordLength: 8,
    maxPasswordLength: 128,
    findCredentialAccount: async (userId) => {
      operations.push(`find-account:${userId}`);
      return { id: "credential-account-id", password: "old-password-hash" };
    },
    verify: async (input) => {
      operations.push(`verify:${input.hash}:${input.password}`);
      return input.hash === "old-password-hash" && input.password === "current-password";
    },
    hash: async (value) => {
      operations.push(`hash:${value}`);
      return "new-password-hash";
    },
    updateAccount: async (id, data) => {
      operations.push(`update-account:${id}:${data.password}`);
    },
  };
  const now = new Date("2026-08-21T00:00:00.000Z");
  const updated = await changePasswordWithBetterAuthAuthority({
    internalAdapter: adapter,
    passwordAuthority: password,
    presentedToken: current.token,
    currentPassword: "current-password",
    newPassword: "new-password",
    newToken: "password-change-token",
    now,
  });
  assert.equal(updated.token, "password-change-token");
  assert.equal(updated.authenticatedAt, authenticatedAt);
  assert.equal(updated.lastRefreshAt, lastRefreshAt);
  assert.equal(updated.expiresAt, expiresAt);
  assert.equal(updated.selectedOrganizationId, "selected-organization-id");
  assert.deepEqual(operations, [
    "find-session:old-session-token",
    "find-account:provider-user-id",
    "verify:old-password-hash:current-password",
    "hash:new-password",
    "update-account:credential-account-id:new-password-hash",
    "list-sessions:provider-user-id",
    "delete-sessions:other-token",
    "update-session:old-session-token",
  ]);
});

test("invalid current password performs zero authoritative mutations", async () => {
  const operations: string[] = [];
  const session = sessionAt({ authenticatedAt: new Date("2026-08-01T00:00:00.000Z") });
  const adapter: SessionAuthoritativeOperations = {
    findSession: async (token) => token === session.token ? { session } : null,
    updateSession: async () => { operations.push("update"); return session; },
    deleteSession: async () => { operations.push("delete"); },
    deleteUserSessions: async () => { operations.push("delete-all"); },
    listSessions: async () => { operations.push("list"); return [session]; },
    deleteSessions: async () => { operations.push("delete-many"); },
  };
  const password: PasswordAuthoritativeOperations = {
    minPasswordLength: 8,
    maxPasswordLength: 128,
    findCredentialAccount: async () => ({ id: "account-id", password: "stored-hash" }),
    verify: async () => false,
    hash: async () => { operations.push("hash"); return "new-hash"; },
    updateAccount: async () => { operations.push("update-account"); },
  };
  await assert.rejects(
    () => changePasswordWithBetterAuthAuthority({
      internalAdapter: adapter,
      passwordAuthority: password,
      presentedToken: session.token,
      currentPassword: "wrong-password",
      newPassword: "new-password",
      newToken: "new-token",
      now: new Date("2026-08-02T00:00:00.000Z"),
    }),
    /STOP_H5_INVALID_CURRENT_PASSWORD/,
  );
  assert.deepEqual(operations, []);
});

test("live H5 exercises sign-in, rollback, rotation, revoke-all, and password change once", {
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
    const valid = await signIn(prisma, { email, password });
    assert.equal(await providerSessionCount(prisma), beforeValid + 1);
    assert.equal(valid.value.providerUserId, userId);
    assert.equal(valid.cookie.present, true);
    assert.equal(valid.cookie.secure, true);
    assert.equal(valid.cookie.httpOnly, true);
    assert.equal(valid.cookie.sameSite, "lax");
    assert.equal(valid.cookie.hostOnly, true);
    const createdSession = await sessionByToken(prisma, valid.value.token);
    assert.equal(createdSession.authenticatedAt.getTime(), createdSession.lastRefreshAt.getTime());
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

    const rotationSignIn = await signIn(prisma, { email, password });
    const rotationBefore = await sessionByToken(prisma, rotationSignIn.value.token);
    const rotatedToken = randomBytes(32).toString("base64url");
    const rotationNow = new Date(rotationBefore.lastRefreshAt.getTime() + SESSION_REFRESH_MS);
    const rotation = await runBetterAuthBoundary({
      rootPrisma: prisma,
      failurePoint: "NONE",
      invoke: async (_api, tx) => {
        const authority = await betterAuthAuthorities(tx);
        return rotateSessionWithBetterAuthAuthority({
          internalAdapter: authority.session,
          presentedToken: rotationBefore.token,
          now: rotationNow,
          newToken: rotatedToken,
        });
      },
    });
    assert.equal(rotation.cookie.present, false);
    assert.equal(rotation.value.action, "ROTATED");
    const rotationAfter = await sessionByToken(prisma, rotatedToken);
    assert.equal(rotationAfter.authenticatedAt.getTime(), rotationBefore.authenticatedAt.getTime());
    assert.equal(rotationAfter.selectedOrganizationId, rotationBefore.selectedOrganizationId);
    assert.equal(rotationAfter.lastRefreshAt.getTime(), rotationNow.getTime());

    for (const expiry of [
      {
        authenticatedAt: new Date("2026-08-01T00:00:00.000Z"),
        lastRefreshAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: new Date("2026-08-08T00:00:00.000Z"),
        now: new Date("2026-08-08T00:00:00.000Z"),
      },
      {
        authenticatedAt: new Date("2026-07-01T00:00:00.000Z"),
        lastRefreshAt: new Date("2026-07-30T00:00:00.000Z"),
        expiresAt: new Date("2026-07-31T00:00:00.000Z"),
        now: new Date("2026-07-31T00:00:00.000Z"),
      },
    ]) {
      const expiringSignIn = await signIn(prisma, { email, password });
      const stored = await sessionByToken(prisma, expiringSignIn.value.token);
      const synthetic: SessionProofRecord = {
        ...stored,
        authenticatedAt: expiry.authenticatedAt,
        lastRefreshAt: expiry.lastRefreshAt,
        expiresAt: expiry.expiresAt,
      };
      const expired = await runBetterAuthBoundary({
        rootPrisma: prisma,
        failurePoint: "NONE",
        invoke: async (_api, tx) => {
          const authority = await betterAuthAuthorities(tx);
          await authority.session.updateSession(stored.token, {
            authenticatedAt: synthetic.authenticatedAt,
            lastRefreshAt: synthetic.lastRefreshAt,
            expiresAt: synthetic.expiresAt,
            updatedAt: expiry.now,
          });
          return rotateSessionWithBetterAuthAuthority({
            internalAdapter: authority.session,
            presentedToken: stored.token,
            now: expiry.now,
            newToken: randomBytes(32).toString("base64url"),
          });
        },
      });
      assert.equal(expired.value.action, "REAUTHENTICATE");
      assert.equal(await prisma.authProviderSession.findUnique({ where: { token: stored.token } }), null);
    }

    await signIn(prisma, { email, password });
    await signIn(prisma, { email, password });
    await runBetterAuthBoundary({
      rootPrisma: prisma,
      failurePoint: "NONE",
      invoke: async (_api, tx) => {
        const authority = await betterAuthAuthorities(tx);
        await revokeAllWithBetterAuthAuthority(authority.session, userId);
        return true;
      },
    });
    assert.equal(await providerSessionCount(prisma, userId), 0);

    const passwordCurrent = await signIn(prisma, { email, password });
    await signIn(prisma, { email, password });
    const passwordSession = await sessionByToken(prisma, passwordCurrent.value.token);
    const changedPassword = `${password}-changed`;
    const passwordToken = randomBytes(32).toString("base64url");
    const changed = await runBetterAuthBoundary({
      rootPrisma: prisma,
      failurePoint: "NONE",
      invoke: async (_api, tx) => {
        const authority = await betterAuthAuthorities(tx);
        return changePasswordWithBetterAuthAuthority({
          internalAdapter: authority.session,
          passwordAuthority: authority.password,
          presentedToken: passwordSession.token,
          currentPassword: password,
          newPassword: changedPassword,
          newToken: passwordToken,
          now: new Date(),
        });
      },
    });
    assert.equal(changed.cookie.present, false);
    assert.equal(changed.value.authenticatedAt.getTime(), passwordSession.authenticatedAt.getTime());
    assert.equal(changed.value.lastRefreshAt.getTime(), passwordSession.lastRefreshAt.getTime());
    assert.equal(changed.value.expiresAt.getTime(), passwordSession.expiresAt.getTime());
    assert.equal(changed.value.selectedOrganizationId, passwordSession.selectedOrganizationId);
    assert.equal(await providerSessionCount(prisma, userId), 1);
    const newPasswordSignIn = await signIn(prisma, { email, password: changedPassword });
    assert.equal(newPasswordSignIn.value.providerUserId, userId);

    console.log("H5_SESSION_BOUNDARY=PASS");
  } finally {
    await prisma.$disconnect();
  }
});
