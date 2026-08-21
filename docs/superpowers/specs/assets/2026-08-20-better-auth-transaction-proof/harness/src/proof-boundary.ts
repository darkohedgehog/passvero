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

export interface BoundaryRootPrisma {
  $transaction<T>(
    action: (tx: TransactionClient) => Promise<T>,
    options: { readonly isolationLevel: "Serializable" },
  ): Promise<T>;
}

export interface BoundaryAttemptAudit {
  readonly rolledBack: boolean;
  readonly commitObserved: boolean;
  readonly cookieEligible: boolean;
  readonly callbackPublished: boolean;
  readonly finalRowDeltas: RowCounts;
}

export interface BoundaryFailedAttemptRecord {
  readonly attemptNumber: number;
  readonly failureClass: "SERIALIZATION" | "DEADLOCK" | "PRISMA_TRANSACTION_CONFLICT" | "NON_RETRYABLE";
  readonly finalRowDeltas: RowCounts;
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

class BoundaryCommittedFailure extends Error {
  readonly commitObserved = true;
  readonly cookieEligible: boolean;
  readonly callbackPublished: boolean;

  constructor(cookieEligible: boolean, callbackPublished: boolean) {
    super("STOP_BOUNDARY_FAILURE_AFTER_COMMIT");
    this.name = "BoundaryCommittedFailure";
    this.cookieEligible = cookieEligible;
    this.callbackPublished = callbackPublished;
  }
}

export const H2_DIRECT_BOUNDARY_RUNTIME_VERDICT = "NOT_EXECUTED" as const;
export const H3_HANDLER_BOUNDARY_RUNTIME_VERDICT = "NOT_EXECUTED" as const;

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
  readonly committed: true;
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
    return {
      value: pending.value,
      cookie: {
        present: true,
        nameHash: createHash("sha256").update(name).digest("hex"),
        secure: attributes.has("secure"),
        httpOnly: attributes.has("httponly"),
        sameSite: attributes.get("samesite")?.toLowerCase() === "lax" ? "lax" : null,
        hostOnly: !attributes.has("domain"),
        maxAgeSeconds: maxAge !== undefined && /^\d+$/.test(maxAge) ? Number(maxAge) : null,
      },
      committed: true,
    };
  } finally {
    pending.capturedHeaders.splice(0, pending.capturedHeaders.length);
  }
}

export async function runBetterAuthBoundary<T>(input: {
  readonly rootPrisma: BoundaryRootPrisma;
  readonly invoke: (
    auth: ProofAuth,
    tx: TransactionClient,
    assertAdapterBound: () => Promise<void>,
  ) => Promise<T>;
  readonly failurePoint: FailurePoint;
  readonly afterCommit?: (value: T) => void | Promise<void>;
  readonly bindTransactionClient?: (tx: TransactionClient) => TransactionClient;
}): Promise<BoundaryResult<T>> {
  readRunIdentity();
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
      return runWithTransaction(adapter, async () => headerCapture.run({ rawHeaders: [] }, async () => {
        try {
          await assertAdapterBound();
          const value = await input.invoke(auth, tx, assertAdapterBound);
          await assertAdapterBound();
          injectFailure(input.failurePoint, "BEFORE_COMMIT");
          return { value, capturedHeaders: takeCapturedHeaders() };
        } catch (error) {
          clearCapturedHeaders();
          throw error;
        }
      }));
    },
    { isolationLevel: "Serializable" },
  );
  const finalized = finalizeAfterCommit(pending);
  let callbackPublished = false;
  try {
    if (input.afterCommit) {
      callbackPublished = true;
      await input.afterCommit(finalized.value);
    }
    injectFailure(input.failurePoint, "AFTER_COMMIT_CALLBACK");
    return finalized;
  } catch {
    throw new BoundaryCommittedFailure(finalized.cookie.present, callbackPublished);
  }
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
  const code = readErrorCode(error);
  return code === "40001" || code === "40P01" || code === "P2034";
}

function safeFailureClass(error: unknown): BoundaryFailedAttemptRecord["failureClass"] {
  const code = readErrorCode(error);
  if (code === "40001") return "SERIALIZATION";
  if (code === "40P01") return "DEADLOCK";
  if (code === "P2034") return "PRISMA_TRANSACTION_CONFLICT";
  return "NON_RETRYABLE";
}

function unsafeAuditReason(audit: BoundaryAttemptAudit): BoundaryRetryStopReason | null {
  if (!audit.rolledBack) return "ROLLBACK_UNPROVEN";
  if (audit.commitObserved) return "COMMIT_OBSERVED";
  if (audit.cookieEligible) return "COOKIE_ELIGIBLE";
  if (audit.callbackPublished) return "CALLBACK_PUBLISHED";
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
      });
      let unsafeReason: BoundaryRetryStopReason | null;
      try {
        unsafeReason = unsafeAuditReason(audit);
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
