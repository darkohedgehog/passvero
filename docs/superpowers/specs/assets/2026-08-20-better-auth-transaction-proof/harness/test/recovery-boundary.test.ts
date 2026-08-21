import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { runWithTransaction } from "@better-auth/core/context";
import type { DBAdapter } from "@better-auth/core/db/adapter";
import * as recovery from "../src/auth.js";
import {
  BoundaryAttemptFailed,
  captureDirectResponseHeaders,
  changePasswordWithBetterAuthAuthority,
  runBetterAuthBoundary,
  runBoundaryWithRetry,
  runCapturedBoundaryAttempt,
  type BetterAuthBoundaryContext,
  type BoundaryRootPrisma,
  type TransactionClient,
  type SessionProofRecord,
} from "../src/proof-boundary.js";
import type { RowCounts } from "../src/evidence.js";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

type Purpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";
type ResetFailurePoint =
  | "NONE"
  | "AFTER_CONSUME"
  | "AFTER_CREDENTIAL_UPDATE"
  | "AFTER_PARTIAL_SESSION_DELETION"
  | "IN_TRANSACTION_CALLBACK";

interface TokenRecord {
  readonly id: string;
  readonly providerUserId: string;
  readonly purpose: Purpose;
  readonly tokenDigest: string;
  readonly targetEmailDigest: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly invalidatedAt: Date | null;
  readonly createdAt: Date;
}

interface ProviderOwner {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

interface TokenStore {
  lockOwner(providerUserId: string): Promise<ProviderOwner | null>;
  invalidateActive(input: {
    readonly providerUserId: string;
    readonly purpose: Purpose;
    readonly at: Date;
  }): Promise<number>;
  create(record: TokenRecord): Promise<TokenRecord>;
  findByDigest(input: {
    readonly purpose: Purpose;
    readonly tokenDigest: string;
  }): Promise<TokenRecord | null>;
  invalidateById(input: { readonly id: string; readonly at: Date }): Promise<boolean>;
  consumeActive(input: {
    readonly id: string;
    readonly purpose: Purpose;
    readonly tokenDigest: string;
    readonly now: Date;
  }): Promise<TokenRecord | null>;
}

interface MutableState {
  owner: ProviderOwner;
  credentialHash: string;
  sessions: SessionProofRecord[];
  tokens: TokenRecord[];
  abuseAdvances: number;
  nextTokenId: number;
  rejectTokenInsert: boolean;
}

interface TransactionView {
  readonly state: MutableState;
  readonly store: TokenStore;
  readonly providerAdapter: Pick<DBAdapter, "update">;
  readonly sessionAdapter: Pick<DBAdapter, "findMany" | "delete" | "deleteMany" | "incrementOne">;
  readonly credentialAuthority: {
    findCredentialAccount(userId: string): Promise<{ readonly id: string; readonly password: string } | null>;
    updateAccount(accountId: string, data: { readonly password: string }): Promise<unknown>;
  };
  readonly password: {
    verify(input: { readonly hash: string; readonly password: string }): Promise<boolean>;
    hash(value: string): Promise<string>;
  };
  readonly abuse: { advance(): Promise<void> };
}

interface RecoveryApi {
  readonly H6_RECOVERY_BOUNDARY_RUNTIME_VERDICT: "NOT_EXECUTED";
  readonly RECOVERY_PROOF_CASES: readonly string[];
  readonly CREDENTIAL_CAPABILITY_BYTES: 32;
  readonly EMAIL_VERIFICATION_LIFETIME_MS: 86_400_000;
  readonly PASSWORD_RESET_LIFETIME_MS: 1_800_000;
  readonly RESET_FAILURE_POINTS: readonly ResetFailurePoint[];
  readonly AFTER_COMMIT_HOOK_CLASSIFICATION: Readonly<Record<string, unknown>>;
  issueCredentialToken(input: {
    readonly store: TokenStore;
    readonly providerUserId: string;
    readonly purpose: Purpose;
    readonly now: Date;
    readonly capabilityKey: Uint8Array;
    readonly targetEmailKey: Uint8Array;
  }): Promise<{ readonly deliveryCapability: string; readonly record: TokenRecord }>;
  verifyEmailWithCredentialToken(input: {
    readonly store: TokenStore;
    readonly providerAdapter: Pick<DBAdapter, "update">;
    readonly abuse: { advance(): Promise<void> };
    readonly deliveryCapability: string;
    readonly now: Date;
    readonly capabilityKey: Uint8Array;
    readonly targetEmailKey: Uint8Array;
    readonly inTransactionCallback?: () => void | Promise<void>;
  }): Promise<
    | { readonly verified: true }
    | { readonly verified: false; readonly failure: "GENERIC_CREDENTIAL_FAILURE" }
  >;
  resetPasswordWithCredentialToken(input: {
    readonly store: TokenStore;
    readonly credentialAuthority: TransactionView["credentialAuthority"];
    readonly password: TransactionView["password"];
    readonly sessionAdapter: Pick<DBAdapter, "findMany" | "delete">;
    readonly abuse: { advance(): Promise<void> };
    readonly deliveryCapability: string;
    readonly replacementPassword: string;
    readonly now: Date;
    readonly capabilityKey: Uint8Array;
    readonly targetEmailKey: Uint8Array;
    readonly failurePoint: ResetFailurePoint;
    readonly inTransactionCallback?: () => void | Promise<void>;
  }): Promise<
    | {
        readonly requiresSignIn: true;
        readonly sessionCreated: false;
        readonly cookieEligible: false;
        readonly sessionsRevoked: number;
      }
    | { readonly failure: "GENERIC_CREDENTIAL_FAILURE" }
  >;
  runAuthenticatedPasswordChange<T>(input: {
    readonly mutateWithTask7Boundary: () => Promise<T>;
    readonly abuse: { advance(): Promise<void> };
    readonly inTransactionCallback?: () => void | Promise<void>;
  }): Promise<T>;
  runRecoveryAfterCommitHook(input: {
    readonly hook: () => void | Promise<void>;
  }): Promise<Readonly<Record<string, unknown>>>;
  credentialTokenEvidence(record: TokenRecord): Readonly<Record<string, unknown>>;
}

function requireRecoveryApi(value: unknown): RecoveryApi {
  if (value === null || typeof value !== "object") throw new Error("STOP_H6_API_MISSING");
  return value as RecoveryApi;
}

const api = requireRecoveryApi(recovery);
const capabilityKey = new Uint8Array(32).fill(0x31);
const targetEmailKey = new Uint8Array(32).fill(0x52);
const issuedAt = new Date("2026-08-21T10:00:00.000Z");

function cloneState(state: MutableState): MutableState {
  return structuredClone(state);
}

function session(id: string, token: string): SessionProofRecord {
  return {
    id,
    userId: "provider-user",
    token,
    expiresAt: new Date("2026-08-28T10:00:00.000Z"),
    authenticatedAt: new Date("2026-08-01T10:00:00.000Z"),
    lastRefreshAt: new Date("2026-08-20T10:00:00.000Z"),
    selectedOrganizationId: "organization-id",
  };
}

function initialState(): MutableState {
  return {
    owner: { id: "provider-user", email: " User@Example.COM ", emailVerified: false },
    credentialHash: "hash:current-password",
    sessions: [
      session("current-session", "current-session-capability"),
      session("other-session-a", "other-session-capability-a"),
      session("other-session-b", "other-session-capability-b"),
    ],
    tokens: [],
    abuseAdvances: 0,
    nextTokenId: 1,
    rejectTokenInsert: false,
  };
}

function digestPassword(value: string): string {
  return `hash:${value}`;
}

function comparable(value: unknown): string | number | boolean | null | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return value === null ? null : undefined;
}

function matchesWhere(
  row: object,
  where: Parameters<DBAdapter["findMany"]>[0]["where"],
): boolean {
  return (where ?? []).every((condition) => {
    const actual = comparable(Reflect.get(row, condition.field));
    const expected = comparable(condition.value);
    if (condition.operator === "eq") return actual === expected;
    if (condition.operator === "ne") return actual !== expected;
    if (condition.operator === "gt") {
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    }
    throw new Error("STOP_H6_TEST_OPERATOR_INVALID");
  });
}

function transactionView(state: MutableState): TransactionView {
  const store: TokenStore = {
    lockOwner: async (providerUserId) => state.owner.id === providerUserId ? { ...state.owner } : null,
    invalidateActive: async ({ providerUserId, purpose, at }) => {
      let count = 0;
      state.tokens = state.tokens.map((record) => {
        if (record.providerUserId !== providerUserId || record.purpose !== purpose
          || record.consumedAt || record.invalidatedAt) return record;
        count += 1;
        return { ...record, invalidatedAt: at };
      });
      return count;
    },
    create: async (record) => {
      if (state.rejectTokenInsert) throw new Error("INJECTED_H6_TOKEN_INSERT_FAILURE");
      if (state.tokens.some((candidate) => candidate.tokenDigest === record.tokenDigest)) {
        throw new Error("STOP_H6_TEST_DUPLICATE_DIGEST");
      }
      state.tokens.push(record);
      state.nextTokenId += 1;
      return record;
    },
    findByDigest: async ({ purpose, tokenDigest }) => state.tokens.find(
      (record) => record.purpose === purpose && record.tokenDigest === tokenDigest,
    ) ?? null,
    invalidateById: async ({ id, at }) => {
      const index = state.tokens.findIndex((record) => record.id === id
        && !record.consumedAt && !record.invalidatedAt);
      if (index < 0) return false;
      state.tokens[index] = { ...state.tokens[index]!, invalidatedAt: at };
      return true;
    },
    consumeActive: async ({ id, purpose, tokenDigest, now }) => {
      const index = state.tokens.findIndex((record) => record.id === id
        && record.purpose === purpose && record.tokenDigest === tokenDigest
        && !record.consumedAt && !record.invalidatedAt && record.expiresAt > now);
      if (index < 0) return null;
      const consumed = { ...state.tokens[index]!, consumedAt: now };
      state.tokens[index] = consumed;
      return consumed;
    },
  };

  const providerAdapter: Pick<DBAdapter, "update"> = {
    update: async <T>(input: Parameters<DBAdapter["update"]>[0]): Promise<T | null> => {
      if (input.model !== "user" || !matchesWhere(state.owner, input.where)) return null;
      state.owner = { ...state.owner, ...input.update } as ProviderOwner;
      return state.owner as unknown as T;
    },
  };

  const sessionAdapter: TransactionView["sessionAdapter"] = {
    findMany: async <T>(input: Parameters<DBAdapter["findMany"]>[0]): Promise<T[]> => state.sessions
      .filter((stored) => input.model === "session" && matchesWhere(stored, input.where)) as unknown as T[],
    delete: async <T>(input: Parameters<DBAdapter["delete"]>[0]): Promise<void> => {
      const index = state.sessions.findIndex((stored) => input.model === "session" && matchesWhere(stored, input.where));
      if (index >= 0) state.sessions.splice(index, 1);
      void (null as T | null);
    },
    deleteMany: async (input) => {
      const before = state.sessions.length;
      state.sessions = state.sessions.filter((stored) => input.model !== "session" || !matchesWhere(stored, input.where));
      return before - state.sessions.length;
    },
    incrementOne: async <T>(input: Parameters<DBAdapter["incrementOne"]>[0]): Promise<T | null> => {
      const index = state.sessions.findIndex((stored) => input.model === "session" && matchesWhere(stored, input.where));
      if (index < 0 || Object.keys(input.increment).length !== 0 || !input.set) return null;
      state.sessions[index] = { ...state.sessions[index]!, ...input.set } as SessionProofRecord;
      return state.sessions[index] as unknown as T;
    },
  };

  return {
    state,
    store,
    providerAdapter,
    sessionAdapter,
    credentialAuthority: {
      findCredentialAccount: async (userId) => userId === state.owner.id
        ? { id: "credential-account", password: state.credentialHash }
        : null,
      updateAccount: async (accountId, data) => {
        if (accountId !== "credential-account") throw new Error("STOP_H6_TEST_ACCOUNT_INVALID");
        state.credentialHash = data.password;
        return { id: accountId };
      },
    },
    password: {
      verify: async ({ hash, password }) => hash === digestPassword(password),
      hash: async (value) => digestPassword(value),
    },
    abuse: { advance: async () => { state.abuseAdvances += 1; } },
  };
}

function transactionRunner(seed: MutableState): {
  readonly read: () => MutableState;
  readonly run: <T>(operation: (view: TransactionView) => Promise<T>) => Promise<T>;
} {
  let committed = cloneState(seed);
  let queue = Promise.resolve();
  return {
    read: () => cloneState(committed),
    run: async <T>(operation: (view: TransactionView) => Promise<T>): Promise<T> => {
      let release: (() => void) | undefined;
      const predecessor = queue;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await predecessor;
      const candidate = cloneState(committed);
      try {
        const value = await operation(transactionView(candidate));
        committed = candidate;
        return value;
      } finally {
        release?.();
      }
    },
  };
}

async function issueReset(view: TransactionView, now = issuedAt) {
  return api.issueCredentialToken({
    store: view.store,
    providerUserId: view.state.owner.id,
    purpose: "PASSWORD_RESET",
    now,
    capabilityKey,
    targetEmailKey,
  });
}

async function reset(
  runner: ReturnType<typeof transactionRunner>,
  deliveryCapability: string,
  failurePoint: ResetFailurePoint,
) {
  return runner.run((view) => api.resetPasswordWithCredentialToken({
    store: view.store,
    credentialAuthority: view.credentialAuthority,
    password: view.password,
    sessionAdapter: view.sessionAdapter,
    abuse: view.abuse,
    deliveryCapability,
    replacementPassword: "replacement-password",
    now: new Date(issuedAt.getTime() + 1_000),
    capabilityKey,
    targetEmailKey,
    failurePoint,
    inTransactionCallback: failurePoint === "IN_TRANSACTION_CALLBACK"
      ? () => { throw new Error("INJECTED_H6_TRANSACTION_CALLBACK"); }
      : undefined,
  }));
}

test("H6 manifest keeps runtime unexecuted and enumerates the recovery contract", () => {
  assert.equal(api.H6_RECOVERY_BOUNDARY_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.equal(api.CREDENTIAL_CAPABILITY_BYTES, 32);
  assert.equal(api.EMAIL_VERIFICATION_LIFETIME_MS, 86_400_000);
  assert.equal(api.PASSWORD_RESET_LIFETIME_MS, 1_800_000);
  assert.deepEqual(api.RESET_FAILURE_POINTS, [
    "NONE", "AFTER_CONSUME", "AFTER_CREDENTIAL_UPDATE",
    "AFTER_PARTIAL_SESSION_DELETION", "IN_TRANSACTION_CALLBACK",
  ]);
  assert.deepEqual(api.RECOVERY_PROOF_CASES, [
    "EMAIL_VERIFICATION_24_HOURS", "PASSWORD_RESET_30_MINUTES",
    "PREDECESSOR_INVALIDATION", "CONCURRENT_SINGLE_USE", "RESET_ATOMIC_ROLLBACK",
    "RESET_REVOKES_ALL_WITHOUT_SIGN_IN", "AUTHENTICATED_CHANGE_ATOMIC_ROTATION",
    "AUTHENTICATED_CHANGE_CONCURRENT_ONE_WINNER", "IN_TRANSACTION_CALLBACK_ROLLBACK",
    "AFTER_COMMIT_HOOK_OPERATIONAL_FAILURE", "DIGEST_ONLY_REDACTED_EVIDENCE",
  ]);
});

test("recovery plugin exposes only pathless server-only credential endpoints", () => {
  const factory = Reflect.get(recovery, "recoveryProofPlugin");
  assert.equal(typeof factory, "function");
  assert.deepEqual(Reflect.get(recovery, "RECOVERY_SERVER_ONLY_ENDPOINTS"), [
    "issueCredentialTokenProof",
    "verifyEmailCredentialProof",
    "resetPasswordCredentialProof",
    "changePasswordCredentialProof",
    "afterCommitCredentialProbe",
  ]);
});

test("credential issuance stores two canonical keyed digests, exact lifetimes, and supersedes predecessors", async () => {
  const state = initialState();
  const view = transactionView(state);
  const verification = await api.issueCredentialToken({
    store: view.store, providerUserId: state.owner.id, purpose: "EMAIL_VERIFICATION",
    now: issuedAt, capabilityKey, targetEmailKey,
  });
  const latestVerification = await api.issueCredentialToken({
    store: view.store, providerUserId: state.owner.id, purpose: "EMAIL_VERIFICATION",
    now: new Date(issuedAt.getTime() + 5_000), capabilityKey, targetEmailKey,
  });
  const predecessor = await issueReset(view);
  const latest = await issueReset(view, new Date(issuedAt.getTime() + 10_000));

  assert.match(verification.deliveryCapability, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(verification.deliveryCapability, "base64url").length, 32);
  assert.equal(verification.record.expiresAt.getTime() - verification.record.createdAt.getTime(), 86_400_000);
  assert.equal(latest.record.expiresAt.getTime() - latest.record.createdAt.getTime(), 1_800_000);
  assert.match(latest.record.tokenDigest, /^[A-Za-z0-9_-]{43}$/);
  assert.match(latest.record.targetEmailDigest, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(latest.record.tokenDigest, latest.record.targetEmailDigest);
  assert.equal(state.tokens.find((record) => record.id === verification.record.id)?.invalidatedAt?.getTime(), latestVerification.record.createdAt.getTime());
  assert.equal(state.tokens.find((record) => record.id === predecessor.record.id)?.invalidatedAt?.getTime(), latest.record.createdAt.getTime());
  assert.equal(state.tokens.filter((record) => !record.consumedAt && !record.invalidatedAt && record.purpose === "PASSWORD_RESET").length, 1);
  const evidence = JSON.stringify(api.credentialTokenEvidence(latest.record));
  assert.doesNotMatch(evidence, new RegExp(latest.deliveryCapability));
  assert.doesNotMatch(JSON.stringify(state.tokens), new RegExp(latest.deliveryCapability));
});

test("issuance insertion failure rolls predecessor invalidation back", async () => {
  const runner = transactionRunner(initialState());
  const predecessor = await runner.run(issueReset);
  const before = runner.read();
  await assert.rejects(() => runner.run(async (view) => {
    view.state.rejectTokenInsert = true;
    await issueReset(view, new Date(issuedAt.getTime() + 10_000));
  }));
  const after = runner.read();
  assert.equal(after.tokens.find((record) => record.id === predecessor.record.id)?.invalidatedAt, null);
  assert.equal(after.tokens.length, before.tokens.length);
});

test("verification concurrent consumers produce one commit and one indistinguishable denial", async () => {
  const runner = transactionRunner(initialState());
  const issued = await runner.run((view) => api.issueCredentialToken({
    store: view.store, providerUserId: view.state.owner.id, purpose: "EMAIL_VERIFICATION",
    now: issuedAt, capabilityKey, targetEmailKey,
  }));
  const consume = () => runner.run((view) => api.verifyEmailWithCredentialToken({
    store: view.store, providerAdapter: view.providerAdapter, abuse: view.abuse,
    deliveryCapability: issued.deliveryCapability,
    now: new Date(issuedAt.getTime() + 1_000), capabilityKey, targetEmailKey,
  }));
  const results = await Promise.all([consume(), consume()]);
  assert.equal(results.filter((value) => value.verified).length, 1);
  assert.deepEqual(results.find((value) => !value.verified), {
    verified: false,
    failure: "GENERIC_CREDENTIAL_FAILURE",
  });
  const state = runner.read();
  assert.equal(state.owner.emailVerified, true);
  assert.equal(state.tokens.filter((record) => record.consumedAt).length, 1);
  assert.equal(state.abuseAdvances, 1);
});

test("email drift commits invalidation and returns the same generic denial", async () => {
  const runner = transactionRunner(initialState());
  const issued = await runner.run((view) => api.issueCredentialToken({
    store: view.store, providerUserId: view.state.owner.id, purpose: "EMAIL_VERIFICATION",
    now: issuedAt, capabilityKey, targetEmailKey,
  }));
  const result = await runner.run(async (view) => {
    view.state.owner = { ...view.state.owner, email: "changed@example.com" };
    return api.verifyEmailWithCredentialToken({
      store: view.store, providerAdapter: view.providerAdapter, abuse: view.abuse,
      deliveryCapability: issued.deliveryCapability,
      now: new Date(issuedAt.getTime() + 1_000), capabilityKey, targetEmailKey,
    });
  });
  assert.deepEqual(result, { verified: false, failure: "GENERIC_CREDENTIAL_FAILURE" });
  assert.equal(runner.read().tokens[0]?.invalidatedAt?.getTime(), issuedAt.getTime() + 1_000);
});

test("every password-reset precommit injection restores credential, active row, sessions, and abuse state", async () => {
  for (const failurePoint of [
    "AFTER_CONSUME", "AFTER_CREDENTIAL_UPDATE", "AFTER_PARTIAL_SESSION_DELETION", "IN_TRANSACTION_CALLBACK",
  ] as const) {
    const runner = transactionRunner(initialState());
    const issued = await runner.run(issueReset);
    const before = runner.read();
    await assert.rejects(() => reset(runner, issued.deliveryCapability, failurePoint));
    assert.deepEqual(runner.read(), before, failurePoint);
  }
});

test("password reset updates through Better Auth authority, revokes all sessions, and returns no sign-in or cookie", async () => {
  const runner = transactionRunner(initialState());
  const issued = await runner.run(issueReset);
  const result = await reset(runner, issued.deliveryCapability, "NONE");
  assert.deepEqual(result, {
    requiresSignIn: true, sessionCreated: false, cookieEligible: false, sessionsRevoked: 3,
  });
  const state = runner.read();
  assert.equal(state.credentialHash, "hash:replacement-password");
  assert.equal(state.tokens.filter((record) => record.consumedAt).length, 1);
  assert.equal(state.sessions.length, 0);
  assert.equal(state.abuseAdvances, 1);
});

test("password-reset concurrent consumers produce one reset and one generic denial", async () => {
  const runner = transactionRunner(initialState());
  const issued = await runner.run(issueReset);
  const consume = () => runner.run((view) => api.resetPasswordWithCredentialToken({
    store: view.store,
    credentialAuthority: view.credentialAuthority,
    password: view.password,
    sessionAdapter: view.sessionAdapter,
    abuse: view.abuse,
    deliveryCapability: issued.deliveryCapability,
    replacementPassword: "replacement-password",
    now: new Date(issuedAt.getTime() + 1_000),
    capabilityKey,
    targetEmailKey,
    failurePoint: "NONE",
  }));
  const results = await Promise.all([consume(), consume()]);
  assert.equal(results.filter((result) => "requiresSignIn" in result).length, 1);
  assert.deepEqual(results.find((result) => "failure" in result), {
    failure: "GENERIC_CREDENTIAL_FAILURE",
  });
  assert.equal(runner.read().tokens.filter((record) => record.consumedAt).length, 1);
  assert.equal(runner.read().sessions.length, 0);
  assert.equal(runner.read().abuseAdvances, 1);
});

test("verification and reset reject their exact expiry deadline generically", async () => {
  for (const purpose of ["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const) {
    const runner = transactionRunner(initialState());
    const issued = await runner.run((view) => api.issueCredentialToken({
      store: view.store, providerUserId: view.state.owner.id, purpose,
      now: issuedAt, capabilityKey, targetEmailKey,
    }));
    const deadline = issued.record.expiresAt;
    const result = await runner.run<unknown>(async (view) => {
      if (purpose === "EMAIL_VERIFICATION") {
        return api.verifyEmailWithCredentialToken({
          store: view.store, providerAdapter: view.providerAdapter, abuse: view.abuse,
          deliveryCapability: issued.deliveryCapability, now: deadline, capabilityKey, targetEmailKey,
        });
      }
      return api.resetPasswordWithCredentialToken({
        store: view.store, credentialAuthority: view.credentialAuthority, password: view.password,
        sessionAdapter: view.sessionAdapter, abuse: view.abuse,
        deliveryCapability: issued.deliveryCapability, replacementPassword: "replacement-password",
        now: deadline, capabilityKey, targetEmailKey, failurePoint: "NONE",
      });
    });
    assert.equal(result !== null && typeof result === "object", true, purpose);
    if (result === null || typeof result !== "object") throw new Error("STOP_H6_TEST_RESULT_INVALID");
    assert.equal("failure" in result, true, purpose);
    assert.equal(runner.read().tokens[0]?.consumedAt, null, purpose);
  }
});

type AuthenticatedChangeFailurePoint =
  | "NONE"
  | "AFTER_CREDENTIAL_UPDATE"
  | "AFTER_OTHER_SESSION_DELETION"
  | "AFTER_CURRENT_SESSION_ROTATION";

async function task7PasswordMutation(
  view: TransactionView,
  currentPassword: string,
  failurePoint: AuthenticatedChangeFailurePoint = "NONE",
): Promise<SessionProofRecord> {
  const current = view.state.sessions.find((stored) => stored.id === "current-session");
  if (!current) throw new Error("STOP_H6_TEST_CURRENT_SESSION_MISSING");
  const credentialAuthority: TransactionView["credentialAuthority"] = {
    ...view.credentialAuthority,
    updateAccount: async (accountId, data) => {
      const result = await view.credentialAuthority.updateAccount(accountId, data);
      if (failurePoint === "AFTER_CREDENTIAL_UPDATE") throw new Error("INJECTED_H6_AFTER_CREDENTIAL_UPDATE");
      return result;
    },
  };
  const sessionAdapter: TransactionView["sessionAdapter"] = {
    ...view.sessionAdapter,
    deleteMany: async (input) => {
      const result = await view.sessionAdapter.deleteMany(input);
      if (failurePoint === "AFTER_OTHER_SESSION_DELETION") throw new Error("INJECTED_H6_AFTER_OTHER_SESSION_DELETION");
      return result;
    },
    incrementOne: async <T>(input: Parameters<DBAdapter["incrementOne"]>[0]): Promise<T | null> => {
      const result = await view.sessionAdapter.incrementOne<T>(input);
      if (failurePoint === "AFTER_CURRENT_SESSION_ROTATION") throw new Error("INJECTED_H6_AFTER_CURRENT_SESSION_ROTATION");
      return result;
    },
  };
  const result = await runCapturedBoundaryAttempt({
    failurePoint: "NONE",
    transactionalWork: () => changePasswordWithBetterAuthAuthority({
      credentialAuthority,
      password: view.password,
      sessionAdapter,
      userId: view.state.owner.id,
      currentPassword,
      newPassword: "authenticated-replacement",
      currentSession: current,
      rotatedToken: "rotated-current-session-capability",
      now: new Date("2026-08-21T10:00:00.000Z"),
      cookieResponse: new Response(null, { headers: {
        "set-cookie": "__Host-proof=rotated-current-session-capability; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax",
      } }),
    }),
  });
  assert.equal(result.cookie.present, true);
  return result.value;
}

test("authenticated change consumes Task 7 rotation and preserves current-session anchors", async () => {
  const runner = transactionRunner(initialState());
  const before = runner.read().sessions[0]!;
  const result = await runner.run((view) => api.runAuthenticatedPasswordChange({
    mutateWithTask7Boundary: () => task7PasswordMutation(view, "current-password"),
    abuse: view.abuse,
  }));
  assert.equal(result.authenticatedAt.getTime(), before.authenticatedAt.getTime());
  assert.equal(result.lastRefreshAt.getTime(), new Date("2026-08-21T10:00:00.000Z").getTime());
  assert.equal(result.expiresAt.getTime(), before.expiresAt.getTime());
  assert.equal(result.selectedOrganizationId, before.selectedOrganizationId);
  assert.equal(runner.read().sessions.length, 1);
  assert.equal(runner.read().credentialHash, "hash:authenticated-replacement");
});

test("authenticated change callback rollback and concurrent attempts leave one committed mutation", async () => {
  const rollbackRunner = transactionRunner(initialState());
  const before = rollbackRunner.read();
  await assert.rejects(() => rollbackRunner.run((view) => api.runAuthenticatedPasswordChange({
    mutateWithTask7Boundary: () => task7PasswordMutation(view, "current-password"),
    abuse: view.abuse,
    inTransactionCallback: () => { throw new Error("INJECTED_H6_TRANSACTION_CALLBACK"); },
  })));
  assert.deepEqual(rollbackRunner.read(), before);

  const concurrentRunner = transactionRunner(initialState());
  const change = () => concurrentRunner.run((view) => api.runAuthenticatedPasswordChange({
    mutateWithTask7Boundary: () => task7PasswordMutation(view, "current-password"),
    abuse: view.abuse,
  }));
  const settled = await Promise.allSettled([change(), change()]);
  assert.equal(settled.filter((value) => value.status === "fulfilled").length, 1);
  assert.equal(concurrentRunner.read().credentialHash, "hash:authenticated-replacement");
  assert.equal(concurrentRunner.read().sessions.length, 1);
  assert.equal(concurrentRunner.read().abuseAdvances, 1);
});

test("authenticated change rolls back every mutation-stage injection", async () => {
  for (const failurePoint of [
    "AFTER_CREDENTIAL_UPDATE", "AFTER_OTHER_SESSION_DELETION", "AFTER_CURRENT_SESSION_ROTATION",
  ] as const) {
    const runner = transactionRunner(initialState());
    const before = runner.read();
    await assert.rejects(() => runner.run((view) => api.runAuthenticatedPasswordChange({
      mutateWithTask7Boundary: () => task7PasswordMutation(view, "current-password", failurePoint),
      abuse: view.abuse,
    })));
    assert.deepEqual(runner.read(), before, failurePoint);
  }
});

test("after-commit hook failure is redacted operational evidence and never a rollback claim", async () => {
  assert.deepEqual(api.AFTER_COMMIT_HOOK_CLASSIFICATION, {
    transactionSource: "transaction.ts:139-150",
    queuedHookSources: ["with-hooks.mjs:31-39", "with-hooks.mjs:67-75"],
    securityCriticalStateAllowed: false,
  });
  const result = await api.runRecoveryAfterCommitHook({
    hook: () => { throw new Error("delivery contained sensitive fixture material"); },
  });
  assert.deepEqual(result, {
    committed: true, rolledBack: false, retryTransaction: false,
    status: "OPERATIONAL_FAILURE", category: "RECOVERY_AFTER_COMMIT_HOOK_FAILED",
  });
  assert.doesNotMatch(JSON.stringify(result), /sensitive fixture material/);
});

test("malformed presentations share one failure", async () => {
  const failures: unknown[] = [];
  for (const candidate of ["not-canonical", "A".repeat(42), `${"A".repeat(43)}=`]) {
    const runner = transactionRunner(initialState());
    failures.push(await runner.run((view) => api.verifyEmailWithCredentialToken({
      store: view.store, providerAdapter: view.providerAdapter, abuse: view.abuse,
      deliveryCapability: candidate, now: issuedAt, capabilityKey, targetEmailKey,
    })));
  }
  assert.deepEqual(failures, Array(3).fill({
    verified: false,
    failure: "GENERIC_CREDENTIAL_FAILURE",
  }));
});

type UnknownRecord = Record<PropertyKey, unknown>;

interface H6CountDelegate {
  count(input?: { readonly where?: Readonly<Record<string, unknown>> }): Promise<number>;
}

interface H6FindUniqueDelegate {
  findUnique(input: { readonly where: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface H6FindManyDelegate {
  findMany(input?: { readonly where?: Readonly<Record<string, unknown>> }): Promise<unknown[]>;
}

interface H6CreateDelegate {
  create(input: { readonly data: Readonly<Record<string, unknown>> }): Promise<unknown>;
}

interface H6UpdateDelegate {
  update(input: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
}

interface H6UpdateManyDelegate {
  updateMany(input: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<{ readonly count: number }>;
  updateManyAndReturn(input: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<unknown[]>;
}

interface H6SqlClient {
  $queryRaw<T>(query: TemplateStringsArray, ...values: readonly unknown[]): Promise<T>;
}

interface H6TransactionClient extends TransactionClient, H6SqlClient {
  readonly authCredentialToken: H6CountDelegate & H6FindUniqueDelegate & H6FindManyDelegate
    & H6CreateDelegate & H6UpdateManyDelegate;
  readonly authAbuseBucket: H6CountDelegate & H6FindUniqueDelegate & H6FindManyDelegate
    & H6CreateDelegate & H6UpdateDelegate;
  readonly proofMarker: H6CountDelegate & H6CreateDelegate;
  readonly user: H6CountDelegate;
  readonly authIdentity: H6CountDelegate;
  readonly accountActivation: H6CountDelegate;
}

interface H6PrismaClient extends H6TransactionClient, BoundaryRootPrisma {
  $disconnect(): Promise<void>;
}

interface H6StageEvidence {
  readonly stage: recovery.RecoveryTransactionStage;
  readonly transactionIdHash: string;
}

interface H6CredentialFixture {
  readonly providerUserId: string;
  readonly email: string;
  readonly password: string;
}

interface H6Snapshot {
  readonly rows: RowCounts;
  readonly sessionCount: number;
  readonly abuseAttemptCount: number;
  readonly tokenConsumed: boolean;
  readonly tokenInvalidated: boolean;
  readonly currentCredentialAccepted: boolean;
  readonly replacementCredentialAccepted: boolean;
}

const H6_ZERO_ROWS = {
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

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function hasH6Method(value: UnknownRecord, property: PropertyKey): boolean {
  return typeof Reflect.get(value, property) === "function";
}

function hasH6Delegate(value: unknown, methods: readonly PropertyKey[]): boolean {
  return isUnknownRecord(value) && methods.every((method) => hasH6Method(value, method));
}

function isH6TransactionClient(value: unknown): value is H6TransactionClient {
  if (!isUnknownRecord(value) || !hasH6Method(value, "$queryRaw")) return false;
  return hasH6Delegate(Reflect.get(value, "authCredentialToken"), [
    "count", "findUnique", "findMany", "create", "updateMany", "updateManyAndReturn",
  ]) && hasH6Delegate(Reflect.get(value, "authAbuseBucket"), [
    "count", "findUnique", "findMany", "create", "update",
  ]) && hasH6Delegate(Reflect.get(value, "proofMarker"), ["count", "create"])
    && hasH6Delegate(Reflect.get(value, "user"), ["count"])
    && hasH6Delegate(Reflect.get(value, "authIdentity"), ["count"])
    && hasH6Delegate(Reflect.get(value, "accountActivation"), ["count"]);
}

function isH6PrismaClient(value: unknown): value is H6PrismaClient {
  return isH6TransactionClient(value) && isUnknownRecord(value)
    && hasH6Method(value, "$transaction") && hasH6Method(value, "$disconnect");
}

function createH6PrismaClient(module: unknown, adapter: PrismaPg): H6PrismaClient {
  if (!isUnknownRecord(module)) throw new Error("STOP_H6_GENERATED_MODULE_INVALID");
  const Constructor = Reflect.get(module, "PrismaClient");
  if (typeof Constructor !== "function") throw new Error("STOP_H6_GENERATED_MODULE_INVALID");
  const client: unknown = Reflect.construct(Constructor, [{ adapter }]);
  if (!isH6PrismaClient(client)) throw new Error("STOP_H6_GENERATED_CLIENT_INVALID");
  return client;
}

function h6RequiredString(value: unknown, stop: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(stop);
  return value;
}

function h6RequiredDate(value: unknown, stop: string): Date {
  if (!(value instanceof Date)) throw new Error(stop);
  return value;
}

function h6TokenRecord(value: unknown): recovery.CredentialTokenRecord {
  if (!isUnknownRecord(value)) throw new Error("STOP_H6_TOKEN_ROW_INVALID");
  const purpose = Reflect.get(value, "purpose");
  if (purpose !== "EMAIL_VERIFICATION" && purpose !== "PASSWORD_RESET") {
    throw new Error("STOP_H6_TOKEN_ROW_INVALID");
  }
  const consumedAt = Reflect.get(value, "consumedAt");
  const invalidatedAt = Reflect.get(value, "invalidatedAt");
  if (consumedAt !== null && !(consumedAt instanceof Date)) throw new Error("STOP_H6_TOKEN_ROW_INVALID");
  if (invalidatedAt !== null && !(invalidatedAt instanceof Date)) throw new Error("STOP_H6_TOKEN_ROW_INVALID");
  return {
    id: h6RequiredString(Reflect.get(value, "id"), "STOP_H6_TOKEN_ROW_INVALID"),
    providerUserId: h6RequiredString(Reflect.get(value, "providerUserId"), "STOP_H6_TOKEN_ROW_INVALID"),
    purpose,
    tokenDigest: h6RequiredString(Reflect.get(value, "tokenDigest"), "STOP_H6_TOKEN_ROW_INVALID"),
    targetEmailDigest: h6RequiredString(Reflect.get(value, "targetEmailDigest"), "STOP_H6_TOKEN_ROW_INVALID"),
    expiresAt: h6RequiredDate(Reflect.get(value, "expiresAt"), "STOP_H6_TOKEN_ROW_INVALID"),
    consumedAt,
    invalidatedAt,
    createdAt: h6RequiredDate(Reflect.get(value, "createdAt"), "STOP_H6_TOKEN_ROW_INVALID"),
  };
}

async function h6TrustedNow(tx: H6SqlClient): Promise<Date> {
  const rows = await tx.$queryRaw<unknown[]>`SELECT statement_timestamp() AS "now"`;
  if (!Array.isArray(rows) || !isUnknownRecord(rows[0])) throw new Error("STOP_H6_TRUSTED_TIME_INVALID");
  return h6RequiredDate(Reflect.get(rows[0], "now"), "STOP_H6_TRUSTED_TIME_INVALID");
}

async function h6TransactionIdHash(tx: H6SqlClient): Promise<string> {
  const rows = await tx.$queryRaw<unknown[]>`SELECT txid_current()::text AS "transactionId"`;
  if (!Array.isArray(rows) || !isUnknownRecord(rows[0])) throw new Error("STOP_H6_TRANSACTION_ID_INVALID");
  return createHash("sha256")
    .update(h6RequiredString(Reflect.get(rows[0], "transactionId"), "STOP_H6_TRANSACTION_ID_INVALID"))
    .digest("hex");
}

function h6Persistence(
  tx: H6TransactionClient,
  rejectInsert: boolean,
): recovery.CredentialTokenPersistence {
  return {
    invalidateActive: async ({ providerUserId, purpose, at }) => (await tx.authCredentialToken.updateMany({
      where: { providerUserId, purpose, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt: at },
    })).count,
    create: async (record) => {
      if (rejectInsert) throw new Error("INJECTED_H6_TOKEN_INSERT_FAILURE");
      return h6TokenRecord(await tx.authCredentialToken.create({ data: { ...record } }));
    },
    findByDigest: async ({ purpose, tokenDigest }) => {
      const row = await tx.authCredentialToken.findUnique({ where: { tokenDigest } });
      if (row === null) return null;
      const record = h6TokenRecord(row);
      return record.purpose === purpose ? record : null;
    },
    invalidateById: async ({ id, at }) => (await tx.authCredentialToken.updateMany({
      where: { id, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt: at },
    })).count === 1,
    consumeActive: async ({ id, purpose, tokenDigest, now }) => {
      const rows = await tx.authCredentialToken.updateManyAndReturn({
        where: {
          id, purpose, tokenDigest, consumedAt: null, invalidatedAt: null, expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (rows.length > 1) throw new Error("STOP_H6_ATOMIC_CONSUME_INVALID");
      return rows[0] === undefined ? null : h6TokenRecord(rows[0]);
    },
  };
}

function h6Boundary(input: {
  readonly tx: H6TransactionClient;
  readonly abuseBucketId: string;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly stages: H6StageEvidence[];
  readonly failurePoint?: recovery.ResetFailurePoint;
  readonly rejectInsert?: boolean;
  readonly injectCallback?: boolean;
}): recovery.RecoveryProofBoundary {
  return {
    persistence: h6Persistence(input.tx, input.rejectInsert ?? false),
    capabilityKey: input.capabilityKey,
    targetEmailKey: input.targetEmailKey,
    trustedNow: () => h6TrustedNow(input.tx),
    resetFailurePoint: input.failurePoint,
    inTransactionCallback: input.injectCallback
      ? () => { throw new Error("INJECTED_H6_TRANSACTION_CALLBACK"); }
      : undefined,
    abuse: {
      advance: async () => {
        await input.tx.authAbuseBucket.update({
          where: { id: input.abuseBucketId },
          data: { attemptCount: { increment: 1 }, backoffUpdatedAt: await h6TrustedNow(input.tx) },
        });
      },
    },
    observer: {
      observe: async (stage) => {
        input.stages.push({ stage, transactionIdHash: await h6TransactionIdHash(input.tx) });
      },
    },
  };
}

async function h6PublicRows(prisma: TransactionClient): Promise<RowCounts> {
  const auth = recovery.createProofAuth({ prisma, adapterTransaction: false, disableSignUp: true });
  const adapter = (await auth.$context).adapter;
  const count = (model: string) => adapter.count({ model, where: [] });
  const client = prisma;
  if (!isH6TransactionClient(client)) throw new Error("STOP_H6_GENERATED_CLIENT_INVALID");
  return {
    providerUser: await count("user"),
    providerAccount: await count("account"),
    providerSession: await count("session"),
    providerVerification: await count("verification"),
    canonicalUser: await client.user.count(),
    authIdentity: await client.authIdentity.count(),
    activation: await client.accountActivation.count(),
    credentialToken: await client.authCredentialToken.count(),
    abuseBucket: await client.authAbuseBucket.count(),
  };
}

function h6RowDeltas(before: RowCounts, after: RowCounts): RowCounts {
  return {
    providerUser: after.providerUser - before.providerUser,
    providerAccount: after.providerAccount - before.providerAccount,
    providerSession: after.providerSession - before.providerSession,
    providerVerification: after.providerVerification - before.providerVerification,
    canonicalUser: after.canonicalUser - before.canonicalUser,
    authIdentity: after.authIdentity - before.authIdentity,
    activation: after.activation - before.activation,
    credentialToken: after.credentialToken - before.credentialToken,
    abuseBucket: after.abuseBucket - before.abuseBucket,
  };
}

async function h6MarkerAbsent(prisma: H6PrismaClient, label: string): Promise<boolean> {
  return (await prisma.proofMarker.count({ where: { label } })) === 0;
}

async function runIndependentH6Boundary<T>(input: {
  readonly prisma: H6PrismaClient;
  readonly label: string;
  readonly abuseBucketId: string;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly stages: H6StageEvidence[];
  readonly failurePoint?: recovery.ResetFailurePoint;
  readonly rejectInsert?: boolean;
  readonly injectCallback?: boolean;
  readonly invoke: (auth: ReturnType<typeof recovery.createRecoveryProofAuth>) => Promise<T>;
  readonly afterCommit?: (value: T, response: Response) => void | Promise<void>;
}) {
  return runBoundaryWithRetry({
    attempt: async (attemptNumber) => {
      const markerLabel = `${input.label}-attempt-${attemptNumber}`;
      return runBetterAuthBoundary({
        rootPrisma: input.prisma,
        failurePoint: "NONE",
        afterCommit: input.afterCommit,
        invoke: async (_api, rawTx) => {
          if (!isH6TransactionClient(rawTx)) throw new Error("STOP_H6_GENERATED_CLIENT_INVALID");
          const auth = recovery.createRecoveryProofAuth({
            prisma: rawTx,
            adapterTransaction: false,
            disableSignUp: true,
            recoveryBoundary: h6Boundary({
              tx: rawTx,
              abuseBucketId: input.abuseBucketId,
              capabilityKey: input.capabilityKey,
              targetEmailKey: input.targetEmailKey,
              stages: input.stages,
              failurePoint: input.failurePoint,
              rejectInsert: input.rejectInsert,
              injectCallback: input.injectCallback,
            }),
          });
          return input.invoke(auth);
        },
        beforeCommitStage: async (rawTx) => {
          if (!isH6TransactionClient(rawTx)) throw new Error("STOP_H6_GENERATED_CLIENT_INVALID");
          await rawTx.proofMarker.create({
            data: { label: markerLabel, transactionId: await h6TransactionIdHash(rawTx) },
          });
        },
      });
    },
    auditFailure: async (_error, attemptNumber) => {
      if (!await h6MarkerAbsent(input.prisma, `${input.label}-attempt-${attemptNumber}`)) {
        throw new Error("STOP_H6_FAILED_ATTEMPT_COMMITTED");
      }
      return { finalRowDeltas: H6_ZERO_ROWS };
    },
  });
}

function h6FixtureLabel(): string {
  return randomBytes(16).toString("hex");
}

function h6ResponseUserId(value: unknown): string {
  if (!isUnknownRecord(value)) throw new Error("STOP_H6_CREDENTIAL_CREATE_FAILED");
  const user = Reflect.get(value, "user");
  if (!isUnknownRecord(user)) throw new Error("STOP_H6_CREDENTIAL_CREATE_FAILED");
  return h6RequiredString(Reflect.get(user, "id"), "STOP_H6_CREDENTIAL_CREATE_FAILED");
}

function h6SignInResult(value: unknown): { readonly providerUserId: string; readonly token: string } {
  if (!isUnknownRecord(value)) throw new Error("STOP_H6_SIGN_IN_RESPONSE_INVALID");
  return {
    providerUserId: h6ResponseUserId(value),
    token: h6RequiredString(Reflect.get(value, "token"), "STOP_H6_SIGN_IN_RESPONSE_INVALID"),
  };
}

async function h6CreateCredential(
  prisma: H6PrismaClient,
  input: { readonly email: string; readonly password: string },
): Promise<H6CredentialFixture> {
  const result = await runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (_api, rawTx) => {
      const auth = recovery.createControlledActivationAuth(rawTx);
      const response = await auth.api.activatePreprovisionedCredential({
        body: {
          credential: input.password,
          email: input.email,
          name: `h6-${h6FixtureLabel()}`,
          providerSubject: `h6-provider-${h6FixtureLabel()}`,
        },
        asResponse: true,
      });
      captureDirectResponseHeaders(response);
      if (!response.ok) throw new Error("STOP_H6_CREDENTIAL_CREATE_FAILED");
      return h6ResponseUserId(await response.json());
    },
  });
  assert.equal(result.cookie.present, false);
  return { providerUserId: result.value, ...input };
}

async function h6CredentialAccepted(
  prisma: H6PrismaClient,
  providerUserId: string,
  password: string,
): Promise<boolean> {
  const result = await runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (_api, _tx, _assertAdapterBound, context: BetterAuthBoundaryContext) => {
      const account = await context.internalAdapter.findCredentialAccount(providerUserId);
      return Boolean(account?.password && await context.password.verify({ hash: account.password, password }));
    },
  });
  assert.equal(result.cookie.present, false);
  return result.value;
}

async function h6SignIn(prisma: H6PrismaClient, email: string, password: string) {
  return runBetterAuthBoundary({
    rootPrisma: prisma,
    failurePoint: "NONE",
    invoke: async (authApi) => {
      const response = await authApi.signInEmail({ body: { email, password }, asResponse: true });
      captureDirectResponseHeaders(response);
      if (!response.ok) throw new Error("STOP_H6_SIGN_IN_REJECTED");
      return h6SignInResult(await response.json());
    },
  });
}

async function h6SessionByToken(
  prisma: H6PrismaClient,
  providerUserId: string,
  token: string,
): Promise<SessionProofRecord> {
  const auth = recovery.createProofAuth({ prisma, adapterTransaction: false, disableSignUp: true });
  const sessions = await (await auth.$context).adapter.findMany<SessionProofRecord>({
    model: "session",
    where: [
      { field: "userId", operator: "eq", value: providerUserId },
      { field: "token", operator: "eq", value: token },
    ],
  });
  if (sessions.length !== 1 || !sessions[0]) throw new Error("STOP_H6_SESSION_NOT_FOUND");
  return sessions[0];
}

async function h6TokenById(prisma: H6PrismaClient, id: string): Promise<recovery.CredentialTokenRecord> {
  return h6TokenRecord(await prisma.authCredentialToken.findUnique({ where: { id } }));
}

async function h6AbuseAttempts(prisma: H6PrismaClient, id: string): Promise<number> {
  const row = await prisma.authAbuseBucket.findUnique({ where: { id } });
  if (!isUnknownRecord(row)) throw new Error("STOP_H6_ABUSE_ROW_INVALID");
  const count = Reflect.get(row, "attemptCount");
  if (!Number.isInteger(count) || typeof count !== "number") throw new Error("STOP_H6_ABUSE_ROW_INVALID");
  return count;
}

async function h6SessionCount(prisma: H6PrismaClient, providerUserId: string): Promise<number> {
  const auth = recovery.createProofAuth({ prisma, adapterTransaction: false, disableSignUp: true });
  return (await auth.$context).adapter.count({
    model: "session",
    where: [{ field: "userId", operator: "eq", value: providerUserId }],
  });
}

async function h6Snapshot(input: {
  readonly prisma: H6PrismaClient;
  readonly fixture: H6CredentialFixture;
  readonly replacementPassword: string;
  readonly abuseBucketId: string;
  readonly tokenId: string;
}): Promise<H6Snapshot> {
  const token = await h6TokenById(input.prisma, input.tokenId);
  return {
    rows: await h6PublicRows(input.prisma),
    sessionCount: await h6SessionCount(input.prisma, input.fixture.providerUserId),
    abuseAttemptCount: await h6AbuseAttempts(input.prisma, input.abuseBucketId),
    tokenConsumed: token.consumedAt !== null,
    tokenInvalidated: token.invalidatedAt !== null,
    currentCredentialAccepted: await h6CredentialAccepted(
      input.prisma, input.fixture.providerUserId, input.fixture.password,
    ),
    replacementCredentialAccepted: await h6CredentialAccepted(
      input.prisma, input.fixture.providerUserId, input.replacementPassword,
    ),
  };
}

function assertH6SensitiveAbsent(haystack: string, needles: readonly string[]): void {
  if (needles.some((needle) => needle.length > 0 && haystack.includes(needle))) {
    throw new Error("STOP_H6_SECRET_LEAK");
  }
}

async function h6DatabaseLeakScan(
  prisma: H6PrismaClient,
  needles: readonly string[],
): Promise<void> {
  const auth = recovery.createProofAuth({ prisma, adapterTransaction: false, disableSignUp: true });
  const adapter = (await auth.$context).adapter;
  const providerRows = await Promise.all(["user", "account", "session", "verification"].map(
    (model) => adapter.findMany<UnknownRecord>({ model, where: [] }),
  ));
  const supportRows = await Promise.all([
    prisma.authCredentialToken.findMany(),
    prisma.authAbuseBucket.findMany(),
  ]);
  assertH6SensitiveAbsent(JSON.stringify({ providerRows, supportRows }), needles);
}

test("live H6 proves recovery with generated Prisma and Better Auth H2 boundaries", {
  skip: process.env.PASSVERO_PROOF_H6 !== "1",
}, async () => {
  const generatedPath = "../generated/client/client.js";
  const generated: unknown = await import(generatedPath);
  const adapter = new PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) });
  const prisma = createH6PrismaClient(generated, adapter);
  const capabilityKey = randomBytes(32);
  const targetEmailKey = randomBytes(32);
  const allCapabilities: string[] = [];
  const allCredentials: string[] = [];
  const runtimeEvidence: Readonly<Record<string, unknown>>[] = [];
  try {
    const abuseBucketId = randomUUID();
    const keyDigest = createHash("sha256").update(randomBytes(32)).digest("base64url");
    const now = new Date();
    await prisma.authAbuseBucket.create({ data: {
      id: abuseBucketId,
      dimension: "ACCOUNT_IDENTIFIER",
      keyDigest,
      attemptCount: 0,
      failureCount: 0,
      backoffLevel: 0,
      windowStartedAt: now,
      lastFailureAt: null,
      backoffUpdatedAt: now,
      blockedUntil: null,
      expiresAt: new Date(now.getTime() + 86_400_000),
    } });
    const beforeRows = await h6PublicRows(prisma);

    const label = h6FixtureLabel();
    const password = `H6-${label}-Old-Aa1!`;
    const replacementPassword = `H6-${label}-New-Aa1!`;
    allCredentials.push(password, replacementPassword);
    const fixture = await h6CreateCredential(prisma, {
      email: `h6-${label}@invalid.example`, password,
    });

    const verificationStages: H6StageEvidence[] = [];
    const verificationIssue = await runIndependentH6Boundary({
      prisma, label: `h6-verify-issue-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: verificationStages,
      invoke: (auth) => auth.api.issueCredentialTokenProof({
        body: { providerUserId: fixture.providerUserId, purpose: "EMAIL_VERIFICATION" },
      }),
    });
    const verificationCapability = verificationIssue.value.value.deliveryCapability;
    allCapabilities.push(verificationCapability);
    assert.equal(
      verificationIssue.value.value.record.expiresAt.getTime()
        - verificationIssue.value.value.record.createdAt.getTime(),
      86_400_000,
    );
    const verifyCall = (consumer: string) => runIndependentH6Boundary({
      prisma, label: `h6-verify-${consumer}-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: verificationStages,
      invoke: (auth) => auth.api.verifyEmailCredentialProof({
        body: { deliveryCapability: verificationCapability },
      }),
    });
    const verificationConsumers = await Promise.all([verifyCall("a"), verifyCall("b")]);
    assert.equal(verificationConsumers.filter((entry) => entry.value.value.verified).length, 1);
    assert.deepEqual(verificationConsumers.find((entry) => !entry.value.value.verified)?.value.value, {
      verified: false, failure: "GENERIC_CREDENTIAL_FAILURE",
    });
    assert.equal((await h6TokenById(prisma, verificationIssue.value.value.record.id)).consumedAt !== null, true);

    const firstSignIn = await h6SignIn(prisma, fixture.email, password);
    const secondSignIn = await h6SignIn(prisma, fixture.email, password);
    assert.equal(firstSignIn.cookie.present, true);
    assert.equal(secondSignIn.cookie.present, true);
    assert.equal(await h6SessionCount(prisma, fixture.providerUserId), 2);

    const predecessorStages: H6StageEvidence[] = [];
    const predecessor = await runIndependentH6Boundary({
      prisma, label: `h6-reset-predecessor-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: predecessorStages,
      invoke: (auth) => auth.api.issueCredentialTokenProof({
        body: { providerUserId: fixture.providerUserId, purpose: "PASSWORD_RESET" },
      }),
    });
    allCapabilities.push(predecessor.value.value.deliveryCapability);
    const current = await runIndependentH6Boundary({
      prisma, label: `h6-reset-current-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: predecessorStages,
      invoke: (auth) => auth.api.issueCredentialTokenProof({
        body: { providerUserId: fixture.providerUserId, purpose: "PASSWORD_RESET" },
      }),
    });
    const resetCapability = current.value.value.deliveryCapability;
    allCapabilities.push(resetCapability);
    assert.equal(
      current.value.value.record.expiresAt.getTime() - current.value.value.record.createdAt.getTime(),
      1_800_000,
    );
    assert.equal((await h6TokenById(prisma, predecessor.value.value.record.id)).invalidatedAt !== null, true);
    const beforeInsertFailure = await h6TokenById(prisma, current.value.value.record.id);
    await assert.rejects(() => runIndependentH6Boundary({
      prisma, label: `h6-reset-insert-failure-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: [], rejectInsert: true,
      invoke: (auth) => auth.api.issueCredentialTokenProof({
        body: { providerUserId: fixture.providerUserId, purpose: "PASSWORD_RESET" },
      }),
    }));
    assert.deepEqual(await h6TokenById(prisma, current.value.value.record.id), beforeInsertFailure);

    for (const failurePoint of [
      "AFTER_CONSUME", "AFTER_CREDENTIAL_UPDATE", "AFTER_PARTIAL_SESSION_DELETION",
    ] as const) {
      const before = await h6Snapshot({
        prisma, fixture, replacementPassword, abuseBucketId, tokenId: current.value.value.record.id,
      });
      await assert.rejects(() => runIndependentH6Boundary({
        prisma, label: `h6-reset-${failurePoint}-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
        stages: [], failurePoint,
        invoke: (auth) => auth.api.resetPasswordCredentialProof({
          body: { deliveryCapability: resetCapability, replacementPassword },
        }),
      }));
      assert.deepEqual(await h6Snapshot({
        prisma, fixture, replacementPassword, abuseBucketId, tokenId: current.value.value.record.id,
      }), before, failurePoint);
    }
    const beforeCallbackFailure = await h6Snapshot({
      prisma, fixture, replacementPassword, abuseBucketId, tokenId: current.value.value.record.id,
    });
    await assert.rejects(() => runIndependentH6Boundary({
      prisma, label: `h6-reset-IN_TRANSACTION_CALLBACK-${label}`, abuseBucketId,
      capabilityKey, targetEmailKey, stages: [], injectCallback: true,
      invoke: (auth) => auth.api.resetPasswordCredentialProof({
        body: { deliveryCapability: resetCapability, replacementPassword },
      }),
    }));
    assert.deepEqual(await h6Snapshot({
      prisma, fixture, replacementPassword, abuseBucketId, tokenId: current.value.value.record.id,
    }), beforeCallbackFailure);

    const resetStages: H6StageEvidence[] = [];
    const resetCall = (consumer: string) => runIndependentH6Boundary({
      prisma, label: `h6-reset-${consumer}-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: resetStages,
      invoke: (auth) => auth.api.resetPasswordCredentialProof({
        body: { deliveryCapability: resetCapability, replacementPassword },
      }),
    });
    const resetConsumers = await Promise.all([resetCall("a"), resetCall("b")]);
    const resetWinner = resetConsumers.find((entry) => "requiresSignIn" in entry.value.value);
    assert.ok(resetWinner);
    if (!("requiresSignIn" in resetWinner.value.value)) throw new Error("STOP_H6_RESET_WINNER_MISSING");
    assert.equal(resetConsumers.filter((entry) => "requiresSignIn" in entry.value.value).length, 1);
    assert.deepEqual(resetConsumers.find((entry) => "failure" in entry.value.value)?.value.value, {
      failure: "GENERIC_CREDENTIAL_FAILURE",
    });
    assert.equal(resetWinner.value.cookie.present, false);
    assert.equal(resetWinner.value.value.cookieEligible, false);
    assert.equal(resetWinner.value.value.sessionCreated, false);
    assert.equal(await h6SessionCount(prisma, fixture.providerUserId), 0);
    assert.equal(await h6CredentialAccepted(prisma, fixture.providerUserId, password), false);
    assert.equal(await h6CredentialAccepted(prisma, fixture.providerUserId, replacementPassword), true);
    await assert.rejects(() => h6SignIn(prisma, fixture.email, password));
    const replacementSignIn = await h6SignIn(prisma, fixture.email, replacementPassword);
    assert.equal(replacementSignIn.cookie.present, true);

    const authenticatedPassword = `H6-${label}-Authenticated-Aa1!`;
    allCredentials.push(authenticatedPassword);
    const currentSession = await h6SessionByToken(
      prisma,
      fixture.providerUserId,
      replacementSignIn.value.token,
    );
    const abuseBeforeChange = await h6AbuseAttempts(prisma, abuseBucketId);
    const changeStages: H6StageEvidence[] = [];
    const changeCall = (consumer: string) => runIndependentH6Boundary({
      prisma, label: `h6-change-${consumer}-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: changeStages,
      invoke: (auth) => auth.api.changePasswordCredentialProof({ body: {
        providerUserId: fixture.providerUserId,
        currentSessionId: currentSession.id,
        presentedToken: currentSession.token,
        currentPassword: replacementPassword,
        newPassword: authenticatedPassword,
        rotatedToken: randomBytes(32).toString("base64url"),
      } }),
    });
    const changes = await Promise.allSettled([changeCall("a"), changeCall("b")]);
    assert.equal(changes.filter((entry) => entry.status === "fulfilled").length, 1);
    const changeWinner = changes.find((entry) => entry.status === "fulfilled");
    assert.ok(changeWinner?.status === "fulfilled");
    assert.equal(changeWinner.value.value.cookie.present, true);
    assert.equal(changeWinner.value.value.value.authenticatedAt.getTime(), currentSession.authenticatedAt.getTime());
    assert.ok(changeWinner.value.value.value.lastRefreshAt > currentSession.lastRefreshAt);
    assert.ok(
      changeWinner.value.value.value.expiresAt.getTime()
        <= changeWinner.value.value.value.authenticatedAt.getTime() + 2_592_000_000,
    );
    assert.ok(
      changeWinner.value.value.value.expiresAt.getTime()
        <= changeWinner.value.value.value.lastRefreshAt.getTime() + 604_800_000,
    );
    assert.equal(
      changeWinner.value.value.value.selectedOrganizationId,
      currentSession.selectedOrganizationId,
    );
    assert.equal(await h6AbuseAttempts(prisma, abuseBucketId), abuseBeforeChange + 1);
    assert.equal(await h6SessionCount(prisma, fixture.providerUserId), 1);
    await assert.rejects(() => h6SignIn(prisma, fixture.email, replacementPassword));
    const authenticatedSignIn = await h6SignIn(prisma, fixture.email, authenticatedPassword);
    assert.equal(authenticatedSignIn.cookie.present, true);

    const committedStages = resetStages.filter((entry) => [
      "TOKEN_CONSUMED", "CREDENTIAL_UPDATED", "SESSION_DELETED", "ABUSE_ADVANCED",
    ].includes(entry.stage));
    assert.ok(committedStages.length >= 5);
    assert.equal(new Set(committedStages.map((entry) => entry.transactionIdHash)).size, 1);

    const postCommitIssue = await runIndependentH6Boundary({
      prisma, label: `h6-postcommit-issue-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: [],
      invoke: (auth) => auth.api.issueCredentialTokenProof({
        body: { providerUserId: fixture.providerUserId, purpose: "PASSWORD_RESET" },
      }),
    });
    allCapabilities.push(postCommitIssue.value.value.deliveryCapability);
    let queuedHookEvidence: Readonly<Record<string, unknown>> | undefined;
    const postCommitReset = await runIndependentH6Boundary({
      prisma, label: `h6-postcommit-reset-${label}`, abuseBucketId, capabilityKey, targetEmailKey,
      stages: [],
      invoke: (auth) => auth.api.resetPasswordCredentialProof({
        body: {
          deliveryCapability: postCommitIssue.value.value.deliveryCapability,
          replacementPassword,
        },
      }),
      afterCommit: async () => {
        const token = await h6TokenById(prisma, postCommitIssue.value.value.record.id);
        assert.equal(token.consumedAt !== null, true);
        assert.equal(await h6SessionCount(prisma, fixture.providerUserId), 0);
        const hookAuth = recovery.createRecoveryProofAuth({
          prisma,
          adapterTransaction: true,
          disableSignUp: true,
          accountUpdateAfter: () => { throw new Error("INJECTED_H6_QUEUED_HOOK_FAILURE"); },
          recoveryBoundary: h6Boundary({
            tx: prisma, abuseBucketId, capabilityKey, targetEmailKey, stages: [],
          }),
        });
        const hookContext = await hookAuth.$context;
        queuedHookEvidence = await api.runRecoveryAfterCommitHook({
          hook: async () => {
            await runWithTransaction(hookContext.adapter, async () => {
              await hookAuth.api.afterCommitCredentialProbe({
                body: { providerUserId: fixture.providerUserId },
              });
            });
          },
        });
      },
    });
    assert.equal(postCommitReset.value.committed, true);
    assert.deepEqual(queuedHookEvidence, {
      committed: true, rolledBack: false, retryTransaction: false,
      status: "OPERATIONAL_FAILURE", category: "RECOVERY_AFTER_COMMIT_HOOK_FAILED",
    });

    await h6DatabaseLeakScan(prisma, [...allCapabilities, ...allCredentials]);
    const afterRows = await h6PublicRows(prisma);
    runtimeEvidence.push({
      verificationOneWinner: true,
      resetOneWinner: true,
      rollbackInjectionCount: 5,
      predecessorInsertionRollback: true,
      digestPattern: /^[A-Za-z0-9_-]{43}$/.test(current.value.value.record.tokenDigest),
      securityStageTransactionHashCount: new Set(committedStages.map((entry) => entry.transactionIdHash)).size,
      resetCookiePresent: resetWinner.value.cookie.present,
      replacementSignInCookiePresent: replacementSignIn.cookie.present,
      authenticatedChangeOneWinner: true,
      authenticatedChangeCookiePresent: changeWinner.value.value.cookie.present,
      currentSessionAnchorsPreserved: true,
      queuedHook: queuedHookEvidence,
      rowDeltas: h6RowDeltas(beforeRows, afterRows),
      abuseAttempts: await h6AbuseAttempts(prisma, abuseBucketId),
    });
    assertH6SensitiveAbsent(JSON.stringify(runtimeEvidence), [...allCapabilities, ...allCredentials]);
  } finally {
    await prisma.$disconnect();
  }
});

type RequiredExports =
  | "issueCredentialToken"
  | "verifyEmailWithCredentialToken"
  | "resetPasswordWithCredentialToken"
  | "runAuthenticatedPasswordChange"
  | "runRecoveryAfterCommitHook"
  | "credentialTokenEvidence";
type MissingExports = Exclude<RequiredExports, keyof typeof recovery>;
const exportContract: MissingExports extends never ? true : never = true;
void exportContract;
