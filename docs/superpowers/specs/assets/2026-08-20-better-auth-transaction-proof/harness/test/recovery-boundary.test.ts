import test from "node:test";
import assert from "node:assert/strict";
import type { DBAdapter } from "@better-auth/core/db/adapter";
import * as recovery from "../src/auth.js";
import {
  changePasswordWithBetterAuthAuthority,
  runCapturedBoundaryAttempt,
  type SessionProofRecord,
} from "../src/proof-boundary.js";

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

test("live H6 remains assigned to the one-shot Task 10 execution", { skip: true }, () => {
  assert.fail("STOP_H6_TASK_10_ONLY");
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
