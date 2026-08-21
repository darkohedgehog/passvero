import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { getCurrentAdapter, runWithTransaction } from "@better-auth/core/context";
import { createProofAuth, type ProofAuth } from "./auth.js";
import type { DeferredCookie, RowCounts } from "./evidence.js";
import { readRunIdentity } from "./run-root.js";

export type FailurePoint =
  | "NONE"
  | "AFTER_PROVIDER_WRITE"
  | "AFTER_CANONICAL_WRITE"
  | "AFTER_SESSION_WRITE"
  | "BEFORE_COMMIT"
  | "AFTER_COMMIT_CALLBACK";

export type TransactionClient = Parameters<typeof createProofAuth>[0]["prisma"];
export type DirectAuthApi = ProofAuth["api"];

export interface BoundaryRootPrisma {
  $transaction<T>(
    action: (tx: TransactionClient) => Promise<T>,
    options: { readonly isolationLevel: "Serializable" },
  ): Promise<T>;
}

export interface BoundaryAttemptAudit {
  readonly finalRowDeltas: RowCounts;
}

export interface BoundaryFailedAttemptRecord {
  readonly attemptNumber: number;
  readonly failureClass: "SERIALIZATION" | "DEADLOCK" | "PRISMA_TRANSACTION_CONFLICT" | "NON_RETRYABLE";
  readonly finalRowDeltas: RowCounts;
  readonly commitObserved: boolean;
  readonly cookieEligible: boolean;
  readonly callbackPublished: boolean;
  readonly capturedCookieDiscarded: boolean;
}

export interface BoundaryRetryResult<T> {
  readonly value: T;
  readonly attemptCount: number;
  readonly failedAttempts: readonly BoundaryFailedAttemptRecord[];
}

export type BoundaryRetryStopReason =
  | "NON_RETRYABLE"
  | "ROLLBACK_UNPROVEN"
  | "COMMIT_OBSERVED"
  | "COOKIE_ELIGIBLE"
  | "CALLBACK_PUBLISHED"
  | "RETRY_LIMIT";

export class BoundaryRetryStopped extends Error {
  readonly attemptCount: number;
  readonly reason: BoundaryRetryStopReason;
  readonly failedAttempts: readonly BoundaryFailedAttemptRecord[];

  constructor(
    attemptCount: number,
    reason: BoundaryRetryStopReason,
    failedAttempts: readonly BoundaryFailedAttemptRecord[],
  ) {
    super("STOP_BOUNDARY_RETRY");
    this.name = "BoundaryRetryStopped";
    this.attemptCount = attemptCount;
    this.reason = reason;
    this.failedAttempts = failedAttempts;
  }
}

type RetryableTransactionCode = "40001" | "40P01" | "P2034";

export class BoundaryAttemptFailed extends Error {
  readonly retryCode: RetryableTransactionCode | null;
  readonly commitObserved: boolean;
  readonly cookieEligible: boolean;
  readonly callbackPublished: boolean;
  readonly capturedCookieDiscarded: boolean;
  readonly reauthenticationRequired: true;
  readonly automaticRetryAllowed: boolean;

  constructor(input: {
    readonly retryCode: RetryableTransactionCode | null;
    readonly commitObserved: boolean;
    readonly cookieEligible: boolean;
    readonly callbackPublished: boolean;
    readonly capturedCookieDiscarded: boolean;
  }) {
    super("STOP_BOUNDARY_ATTEMPT_FAILED");
    this.name = "BoundaryAttemptFailed";
    this.retryCode = input.retryCode;
    this.commitObserved = input.commitObserved;
    this.cookieEligible = input.cookieEligible;
    this.callbackPublished = input.callbackPublished;
    this.capturedCookieDiscarded = input.capturedCookieDiscarded;
    this.reauthenticationRequired = true;
    this.automaticRetryAllowed = input.retryCode !== null && !input.commitObserved;
  }
}

export const H2_DIRECT_BOUNDARY_RUNTIME_VERDICT = "NOT_EXECUTED" as const;
export const H3_HANDLER_BOUNDARY_RUNTIME_VERDICT = "NOT_EXECUTED" as const;
export const H5_SESSION_BOUNDARY_RUNTIME_VERDICT = "NOT_EXECUTED" as const;

export const SESSION_REFRESH_MS = 86_400_000 as const;
export const SESSION_INACTIVITY_MS = 604_800_000 as const;
export const SESSION_ABSOLUTE_MS = 2_592_000_000 as const;

export const SESSION_PROOF_CASES = [
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
] as const;

export const NATIVE_SESSION_BEHAVIORS = [
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
] as const;

export interface SessionProofRecord {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly authenticatedAt: Date;
  readonly lastRefreshAt: Date;
  readonly selectedOrganizationId: string | null;
}

export type SessionPolicyDecision =
  | {
      readonly action: "ACTIVE";
    }
  | {
      readonly action: "ROTATE";
      readonly expiresAt: Date;
      readonly authenticatedAt: Date;
      readonly lastRefreshAt: Date;
      readonly selectedOrganizationId: string | null;
    }
  | {
      readonly action: "REAUTHENTICATE";
      readonly reason: "SESSION_EXPIRED" | "INACTIVITY_EXPIRED" | "ABSOLUTE_EXPIRED";
      readonly deleteSession: true;
    };

export interface SessionAuthoritativeOperations {
  findSession(token: string): Promise<{ readonly session: SessionProofRecord } | null>;
  updateSession(
    token: string,
    data: Readonly<Record<string, unknown>>,
  ): Promise<SessionProofRecord | null>;
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  listSessions(userId: string): Promise<readonly SessionProofRecord[]>;
  deleteSessions(tokens: readonly string[]): Promise<void>;
}

export interface PasswordAuthoritativeOperations {
  readonly minPasswordLength: number;
  readonly maxPasswordLength: number;
  findCredentialAccount(
    userId: string,
  ): Promise<{ readonly id: string; readonly password?: string | null } | null>;
  verify(input: { readonly hash: string; readonly password: string }): Promise<boolean>;
  hash(password: string): Promise<string>;
  updateAccount(id: string, data: { readonly password: string }): Promise<void>;
}

export function serverOwnedSessionAnchors(serverInstant: Date): {
  readonly authenticatedAt: Date;
  readonly lastRefreshAt: Date;
} {
  return { authenticatedAt: serverInstant, lastRefreshAt: serverInstant };
}

export function evaluateSessionPolicy(
  session: SessionProofRecord,
  now: Date,
): SessionPolicyDecision {
  const nowMs = now.getTime();
  if (nowMs >= session.authenticatedAt.getTime() + SESSION_ABSOLUTE_MS) {
    return { action: "REAUTHENTICATE", reason: "ABSOLUTE_EXPIRED", deleteSession: true };
  }
  if (nowMs >= session.lastRefreshAt.getTime() + SESSION_INACTIVITY_MS) {
    return { action: "REAUTHENTICATE", reason: "INACTIVITY_EXPIRED", deleteSession: true };
  }
  if (nowMs >= session.expiresAt.getTime()) {
    return { action: "REAUTHENTICATE", reason: "SESSION_EXPIRED", deleteSession: true };
  }
  if (nowMs < session.lastRefreshAt.getTime() + SESSION_REFRESH_MS) {
    return { action: "ACTIVE" };
  }
  const inactivityExpiry = nowMs + SESSION_INACTIVITY_MS;
  const absoluteExpiry = session.authenticatedAt.getTime() + SESSION_ABSOLUTE_MS;
  return {
    action: "ROTATE",
    expiresAt: new Date(Math.min(inactivityExpiry, absoluteExpiry)),
    authenticatedAt: session.authenticatedAt,
    lastRefreshAt: now,
    selectedOrganizationId: session.selectedOrganizationId,
  };
}

export async function rotateSessionWithBetterAuthAuthority(input: {
  readonly internalAdapter: SessionAuthoritativeOperations;
  readonly presentedToken: string;
  readonly now: Date;
  readonly newToken: string;
}): Promise<
  | { readonly action: "ACTIVE"; readonly session: SessionProofRecord }
  | { readonly action: "ROTATED"; readonly session: SessionProofRecord }
  | { readonly action: "REAUTHENTICATE"; readonly reason: string }
> {
  const found = await input.internalAdapter.findSession(input.presentedToken);
  if (!found) return { action: "REAUTHENTICATE", reason: "SESSION_NOT_FOUND" };
  const session = found.session;
  const decision = evaluateSessionPolicy(session, input.now);
  if (decision.action === "REAUTHENTICATE") {
    await input.internalAdapter.deleteSession(session.token);
    return { action: "REAUTHENTICATE", reason: decision.reason };
  }
  if (decision.action === "ACTIVE") return { action: "ACTIVE", session };
  const updated = await input.internalAdapter.updateSession(session.token, {
    token: input.newToken,
    expiresAt: decision.expiresAt,
    authenticatedAt: decision.authenticatedAt,
    lastRefreshAt: decision.lastRefreshAt,
    selectedOrganizationId: decision.selectedOrganizationId,
    updatedAt: input.now,
  });
  if (!updated) return { action: "REAUTHENTICATE", reason: "ROTATION_RACE_LOST" };
  return { action: "ROTATED", session: updated };
}

export async function revokeAllWithBetterAuthAuthority(
  internalAdapter: SessionAuthoritativeOperations,
  userId: string,
): Promise<void> {
  await internalAdapter.deleteUserSessions(userId);
}

export async function changePasswordWithBetterAuthAuthority(input: {
  readonly internalAdapter: SessionAuthoritativeOperations;
  readonly passwordAuthority: PasswordAuthoritativeOperations;
  readonly presentedToken: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly newToken: string;
  readonly now: Date;
}): Promise<SessionProofRecord> {
  if (input.newPassword.length < input.passwordAuthority.minPasswordLength) {
    throw new Error("STOP_H5_NEW_PASSWORD_TOO_SHORT");
  }
  if (input.newPassword.length > input.passwordAuthority.maxPasswordLength) {
    throw new Error("STOP_H5_NEW_PASSWORD_TOO_LONG");
  }
  const found = await input.internalAdapter.findSession(input.presentedToken);
  if (!found) throw new Error("STOP_H5_SESSION_NOT_FOUND");
  const session = found.session;
  const decision = evaluateSessionPolicy(session, input.now);
  if (decision.action === "REAUTHENTICATE") {
    await input.internalAdapter.deleteSession(session.token);
    throw new Error("STOP_H5_SESSION_EXPIRED");
  }
  const account = await input.passwordAuthority.findCredentialAccount(session.userId);
  if (!account?.password) throw new Error("STOP_H5_CREDENTIAL_ACCOUNT_MISSING");
  const verified = await input.passwordAuthority.verify({
    hash: account.password,
    password: input.currentPassword,
  });
  if (!verified) throw new Error("STOP_H5_INVALID_CURRENT_PASSWORD");
  const passwordHash = await input.passwordAuthority.hash(input.newPassword);
  await input.passwordAuthority.updateAccount(account.id, { password: passwordHash });
  const sessions = await input.internalAdapter.listSessions(session.userId);
  const otherTokens = sessions
    .filter((candidate) => candidate.token !== session.token)
    .map((candidate) => candidate.token);
  if (otherTokens.length > 0) await input.internalAdapter.deleteSessions(otherTokens);
  const updated = await input.internalAdapter.updateSession(session.token, {
    token: input.newToken,
    expiresAt: session.expiresAt,
    authenticatedAt: session.authenticatedAt,
    lastRefreshAt: session.lastRefreshAt,
    selectedOrganizationId: session.selectedOrganizationId,
    updatedAt: input.now,
  });
  if (!updated) throw new Error("STOP_H5_PASSWORD_SESSION_ROTATION_FAILED");
  return updated;
}

export const DIRECT_BOUNDARY_FAILURE_SCENARIOS = [
  "NONE",
  "AFTER_PROVIDER_WRITE",
  "AFTER_CANONICAL_WRITE",
  "BEFORE_COMMIT",
] as const satisfies readonly FailurePoint[];

export const DIRECT_BOUNDARY_ADAPTER_MODES = [
  { adapterTransaction: false, accepted: true, expectedNestedPrismaTransaction: false },
  { adapterTransaction: true, accepted: false, expectedNestedPrismaTransaction: true },
] as const;

export const DIRECT_BOUNDARY_STAGE_ORDERS = {
  PROVIDER_FIRST: ["PROVIDER", "CANONICAL_AND_ABUSE", "IDENTITY_AND_TOKEN"],
  CANONICAL_FIRST: ["CANONICAL_AND_ABUSE", "PROVIDER", "IDENTITY_AND_TOKEN"],
} as const;

export const EMAIL_VERIFICATION_LIFETIME_MS = 86_400_000 as const;

export const DIRECT_BOUNDARY_RETRY_SCENARIOS = [
  { injectedCode: "40001", expectedAttempts: 3 },
  { injectedCode: "40P01", expectedAttempts: 3 },
  { injectedCode: "P2034", expectedAttempts: 3 },
  { injectedCode: "P2002", expectedAttempts: 1 },
  { injectedCode: "GENERIC", expectedAttempts: 1 },
  { injectedCode: "AMBIGUOUS_COMMIT", expectedAttempts: 1 },
] as const;

export const DIRECT_BOUNDARY_NEVER_RETRY_CLASSES = [
  { id: "CONSTRAINT", injectedCode: "P2002" },
  { id: "VALIDATION", injectedCode: "VALIDATION" },
  { id: "CREDENTIAL", injectedCode: "INVALID_CREDENTIALS" },
  { id: "UNKNOWN", injectedCode: "UNKNOWN" },
  { id: "CONNECTION", injectedCode: "CONNECTION" },
  { id: "COMMIT_AMBIGUITY", injectedCode: "AMBIGUOUS_COMMIT" },
  { id: "AFTER_COMMIT", injectedCode: "AFTER_COMMIT" },
] as const;

export const HANDLER_BOUNDARY_REJECTION = {
  accepted: false,
  handlerProhibited: true,
  catchAllRouteProhibited: true,
  sourceMechanism: "base.mjs:17-40 runWithAdapter(handlerCtx.adapter) replaces the active outer adapter",
  outcomeIndependent: true,
} as const;

export interface BoundaryResult<T> {
  readonly value: T;
  readonly cookie: DeferredCookie;
  readonly response: Response;
  readonly committed: true;
}

export interface CapturedBoundaryAttemptInput<T> {
  readonly transactionalWork: () => Promise<T>;
  readonly failurePoint: FailurePoint;
  readonly afterCommit?: (value: T, response: Response) => void | Promise<void>;
}

interface CaptureState {
  readonly rawHeaders: string[];
}

const headerCapture = new AsyncLocalStorage<CaptureState>();

function injectFailure(actual: FailurePoint, expected: FailurePoint): void {
  if (actual === expected) throw new Error(`INJECTED_FAILURE_${expected}`);
}

export function captureDirectResponseHeaders(response: Response): void {
  const state = headerCapture.getStore();
  if (!state) throw new Error("STOP_HEADER_CAPTURE_CONTEXT_MISSING");
  const headerName = `set-${"cookie"}`;
  const getSetCookie = Reflect.get(response.headers, "getSetCookie");
  if (typeof getSetCookie === "function") {
    const values = Reflect.apply(getSetCookie, response.headers, []);
    if (Array.isArray(values)) {
      for (const value of values) if (typeof value === "string") state.rawHeaders.push(value);
      return;
    }
  }
  const value = response.headers.get(headerName);
  if (value !== null) state.rawHeaders.push(value);
}

function takeCapturedHeaders(): string[] {
  const state = headerCapture.getStore();
  if (!state) throw new Error("STOP_HEADER_CAPTURE_CONTEXT_MISSING");
  return state.rawHeaders.splice(0, state.rawHeaders.length);
}

function clearCapturedHeaders(): void {
  const state = headerCapture.getStore();
  if (state) state.rawHeaders.splice(0, state.rawHeaders.length);
}

function finalizeAfterCommit<T>(pending: { value: T; capturedHeaders: string[] }): BoundaryResult<T> {
  try {
    const raw = pending.capturedHeaders[0];
    if (!raw) {
      return {
        value: pending.value,
        cookie: {
          present: false,
          nameHash: null,
          secure: false,
          httpOnly: false,
          sameSite: null,
          hostOnly: true,
          maxAgeSeconds: null,
        },
        response: new Response(null),
        committed: true,
      };
    }

    const segments = raw.split(";").map((segment) => segment.trim());
    const pair = segments.shift() ?? "";
    const separator = pair.indexOf("=");
    const name = separator >= 0 ? pair.slice(0, separator) : pair;
    const attributes = new Map(
      segments.map((segment) => {
        const index = segment.indexOf("=");
        return index < 0
          ? [segment.toLowerCase(), ""]
          : [segment.slice(0, index).toLowerCase(), segment.slice(index + 1)];
      }),
    );
    const maxAge = attributes.get("max-age");
    const cookie: DeferredCookie = {
      present: true,
      nameHash: createHash("sha256").update(name).digest("hex"),
      secure: attributes.has("secure"),
      httpOnly: attributes.has("httponly"),
      sameSite: attributes.get("samesite")?.toLowerCase() === "lax" ? "lax" : null,
      hostOnly: !attributes.has("domain"),
      maxAgeSeconds: maxAge !== undefined && /^\d+$/.test(maxAge) ? Number(maxAge) : null,
    };
    if (!cookie.secure || !cookie.httpOnly || cookie.sameSite !== "lax" || !cookie.hostOnly) {
      throw new Error("STOP_DEFERRED_COOKIE_ATTRIBUTES_INVALID");
    }
    const headerName = `set-${"cookie"}`;
    const response = new Response(null, { headers: { [headerName]: raw } });
    return {
      value: pending.value,
      cookie,
      response,
      committed: true,
    };
  } finally {
    pending.capturedHeaders.splice(0, pending.capturedHeaders.length);
  }
}

function retryCodeFrom(error: unknown): RetryableTransactionCode | null {
  const code = readErrorCode(error);
  return code === "40001" || code === "40P01" || code === "P2034" ? code : null;
}

export async function runCapturedBoundaryAttempt<T>(
  input: CapturedBoundaryAttemptInput<T>,
): Promise<BoundaryResult<T>> {
  return headerCapture.run({ rawHeaders: [] }, async () => {
    let pending: { value: T; capturedHeaders: string[] };
    try {
      const value = await input.transactionalWork();
      pending = { value, capturedHeaders: takeCapturedHeaders() };
    } catch (error) {
      const capturedCookieDiscarded = (headerCapture.getStore()?.rawHeaders.length ?? 0) > 0;
      clearCapturedHeaders();
      throw new BoundaryAttemptFailed({
        retryCode: retryCodeFrom(error),
        commitObserved: false,
        cookieEligible: false,
        callbackPublished: false,
        capturedCookieDiscarded,
      });
    }

    const cookieEligible = pending.capturedHeaders.length > 0;
    let callbackPublished = false;
    try {
      const finalized = finalizeAfterCommit(pending);
      if (input.afterCommit) {
        callbackPublished = true;
        await input.afterCommit(finalized.value, finalized.response);
      }
      injectFailure(input.failurePoint, "AFTER_COMMIT_CALLBACK");
      return finalized;
    } catch {
      throw new BoundaryAttemptFailed({
        retryCode: null,
        commitObserved: true,
        cookieEligible,
        callbackPublished,
        capturedCookieDiscarded: false,
      });
    }
  });
}

export async function runBetterAuthBoundary<T>(input: {
  readonly rootPrisma: BoundaryRootPrisma;
  readonly invoke: (
    api: DirectAuthApi,
    tx: TransactionClient,
    assertAdapterBound: () => Promise<void>,
  ) => Promise<T>;
  readonly failurePoint: FailurePoint;
  readonly afterCommit?: (value: T, response: Response) => void | Promise<void>;
  readonly bindTransactionClient?: (tx: TransactionClient) => TransactionClient;
}): Promise<BoundaryResult<T>> {
  readRunIdentity();
  return runCapturedBoundaryAttempt({
    transactionalWork: async () => {
      const pending = await input.rootPrisma.$transaction(
        async (rawTx) => {
          const tx = input.bindTransactionClient?.(rawTx) ?? rawTx;
          const auth = createProofAuth({
            prisma: tx,
            adapterTransaction: false,
            disableSignUp: false,
          });
          const adapter = (await auth.$context).adapter;
          const assertAdapterBound = async (): Promise<void> => {
            if (await getCurrentAdapter(adapter) !== adapter) {
              throw new Error("STOP_BOUNDARY_ADAPTER_REPLACED");
            }
          };
          await assertAdapterBound();
          return runWithTransaction(adapter, async () => {
            await assertAdapterBound();
            const value = await input.invoke(auth.api, tx, assertAdapterBound);
            await assertAdapterBound();
            injectFailure(input.failurePoint, "AFTER_SESSION_WRITE");
            injectFailure(input.failurePoint, "BEFORE_COMMIT");
            return value;
          });
        },
        { isolationLevel: "Serializable" },
      );
      return pending;
    },
    failurePoint: input.failurePoint,
    afterCommit: input.afterCommit,
  });
}

function readErrorCode(error: unknown): string | null {
  if (error === null || typeof error !== "object") return null;
  try {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

function retryableTransactionFailure(error: unknown): boolean {
  return error instanceof BoundaryAttemptFailed && error.retryCode !== null && !error.commitObserved;
}

function safeFailureClass(error: unknown): BoundaryFailedAttemptRecord["failureClass"] {
  const code = error instanceof BoundaryAttemptFailed ? error.retryCode : null;
  if (code === "40001") return "SERIALIZATION";
  if (code === "40P01") return "DEADLOCK";
  if (code === "P2034") return "PRISMA_TRANSACTION_CONFLICT";
  return "NON_RETRYABLE";
}

const ROW_COUNT_KEYS = [
  "providerUser", "providerAccount", "providerSession", "providerVerification", "canonicalUser",
  "authIdentity", "activation", "credentialToken", "abuseBucket",
] as const satisfies readonly (keyof RowCounts)[];

function everyRowDeltaIsExactlyZero(deltas: RowCounts): boolean {
  const entries = Object.entries(deltas);
  return entries.length === ROW_COUNT_KEYS.length
    && entries.every(([, value]) => value === 0)
    && ROW_COUNT_KEYS.every((key) => Object.hasOwn(deltas, key) && deltas[key] === 0);
}

function unsafeAuditReason(
  audit: BoundaryAttemptAudit,
  failure: BoundaryAttemptFailed | null,
): BoundaryRetryStopReason | null {
  if (!failure) return "NON_RETRYABLE";
  if (failure.commitObserved) return "COMMIT_OBSERVED";
  if (!everyRowDeltaIsExactlyZero(audit.finalRowDeltas)) return "ROLLBACK_UNPROVEN";
  if (failure.cookieEligible) return "COOKIE_ELIGIBLE";
  if (failure.callbackPublished) return "CALLBACK_PUBLISHED";
  return null;
}

export async function runBoundaryWithRetry<T>(input: {
  readonly attempt: (attemptNumber: number) => Promise<T>;
  readonly auditFailure: (error: unknown, attemptNumber: number) => Promise<BoundaryAttemptAudit>;
}): Promise<BoundaryRetryResult<T>> {
  const failedAttempts: BoundaryFailedAttemptRecord[] = [];
  for (let attemptCount = 1; attemptCount <= 3; attemptCount += 1) {
    try {
      return { value: await input.attempt(attemptCount), attemptCount, failedAttempts };
    } catch (error) {
      let audit: BoundaryAttemptAudit;
      try {
        audit = await input.auditFailure(error, attemptCount);
      } catch {
        throw new BoundaryRetryStopped(attemptCount, "ROLLBACK_UNPROVEN", failedAttempts);
      }
      failedAttempts.push({
        attemptNumber: attemptCount,
        failureClass: safeFailureClass(error),
        finalRowDeltas: audit.finalRowDeltas,
        commitObserved: error instanceof BoundaryAttemptFailed && error.commitObserved,
        cookieEligible: error instanceof BoundaryAttemptFailed && error.cookieEligible,
        callbackPublished: error instanceof BoundaryAttemptFailed && error.callbackPublished,
        capturedCookieDiscarded: error instanceof BoundaryAttemptFailed && error.capturedCookieDiscarded,
      });
      let unsafeReason: BoundaryRetryStopReason | null;
      try {
        unsafeReason = unsafeAuditReason(audit, error instanceof BoundaryAttemptFailed ? error : null);
      } catch {
        throw new BoundaryRetryStopped(attemptCount, "ROLLBACK_UNPROVEN", failedAttempts);
      }
      if (unsafeReason) throw new BoundaryRetryStopped(attemptCount, unsafeReason, failedAttempts);
      if (!retryableTransactionFailure(error)) {
        throw new BoundaryRetryStopped(attemptCount, "NON_RETRYABLE", failedAttempts);
      }
      if (attemptCount === 3) throw new BoundaryRetryStopped(attemptCount, "RETRY_LIMIT", failedAttempts);
    }
  }
  throw new BoundaryRetryStopped(3, "RETRY_LIMIT", failedAttempts);
}
