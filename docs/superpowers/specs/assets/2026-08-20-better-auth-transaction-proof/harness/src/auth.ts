import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { AuthContext, BetterAuthOptions } from "@better-auth/core";
import { createAuthEndpoint } from "better-auth/api";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import type { DBAdapter } from "@better-auth/core/db/adapter";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { domainToASCII } from "node:url";
import * as z from "zod";
import {
  changePasswordWithBetterAuthAuthority,
  type SessionProofRecord,
  type BetterAuthCredentialAuthority,
  type BetterAuthPasswordAuthority,
} from "./proof-boundary.js";
import { readAuthSecret, readRunIdentity } from "./run-root.js";

export const H6_RECOVERY_BOUNDARY_RUNTIME_VERDICT = "NOT_EXECUTED" as const;
export const CREDENTIAL_CAPABILITY_BYTES = 32 as const;
export const EMAIL_VERIFICATION_LIFETIME_MS = 86_400_000 as const;
export const PASSWORD_RESET_LIFETIME_MS = 1_800_000 as const;

export const RECOVERY_PROOF_CASES = [
  "EMAIL_VERIFICATION_24_HOURS",
  "PASSWORD_RESET_30_MINUTES",
  "PREDECESSOR_INVALIDATION",
  "CONCURRENT_SINGLE_USE",
  "RESET_ATOMIC_ROLLBACK",
  "RESET_REVOKES_ALL_WITHOUT_SIGN_IN",
  "AUTHENTICATED_CHANGE_ATOMIC_ROTATION",
  "AUTHENTICATED_CHANGE_CONCURRENT_ONE_WINNER",
  "IN_TRANSACTION_CALLBACK_ROLLBACK",
  "AFTER_COMMIT_HOOK_OPERATIONAL_FAILURE",
  "DIGEST_ONLY_REDACTED_EVIDENCE",
] as const;

export const RESET_FAILURE_POINTS = [
  "NONE",
  "AFTER_CONSUME",
  "AFTER_CREDENTIAL_UPDATE",
  "AFTER_PARTIAL_SESSION_DELETION",
  "IN_TRANSACTION_CALLBACK",
] as const;

export const AFTER_COMMIT_HOOK_CLASSIFICATION = {
  transactionSource: "transaction.ts:139-150",
  queuedHookSources: ["with-hooks.mjs:31-39", "with-hooks.mjs:67-75"],
  securityCriticalStateAllowed: false,
} as const;

export const RECOVERY_SERVER_ONLY_ENDPOINTS = [
  "issueCredentialTokenProof",
  "verifyEmailCredentialProof",
  "resetPasswordCredentialProof",
  "changePasswordCredentialProof",
  "afterCommitCredentialProbe",
] as const;

export type CredentialTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";
export type ResetFailurePoint = (typeof RESET_FAILURE_POINTS)[number];

export interface CredentialTokenRecord {
  readonly id: string;
  readonly providerUserId: string;
  readonly purpose: CredentialTokenPurpose;
  readonly tokenDigest: string;
  readonly targetEmailDigest: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly invalidatedAt: Date | null;
  readonly createdAt: Date;
}

export interface CredentialTokenOwner {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface CredentialTokenStore {
  lockOwner(providerUserId: string): Promise<CredentialTokenOwner | null>;
  invalidateActive(input: {
    readonly providerUserId: string;
    readonly purpose: CredentialTokenPurpose;
    readonly at: Date;
  }): Promise<number>;
  create(record: CredentialTokenRecord): Promise<CredentialTokenRecord>;
  findByDigest(input: {
    readonly purpose: CredentialTokenPurpose;
    readonly tokenDigest: string;
  }): Promise<CredentialTokenRecord | null>;
  invalidateById(input: { readonly id: string; readonly at: Date }): Promise<boolean>;
  consumeActive(input: {
    readonly id: string;
    readonly purpose: CredentialTokenPurpose;
    readonly tokenDigest: string;
    readonly now: Date;
  }): Promise<CredentialTokenRecord | null>;
}

export type CredentialTokenPersistence = Omit<CredentialTokenStore, "lockOwner">;

export type RecoveryTransactionStage =
  | "OWNER_LOCKED"
  | "PREDECESSORS_INVALIDATED"
  | "TOKEN_INSERTED"
  | "TOKEN_CONSUMED"
  | "PROVIDER_VERIFIED"
  | "CREDENTIAL_UPDATED"
  | "SESSION_DELETED"
  | "ABUSE_ADVANCED";

export interface RecoveryTransactionObserver {
  observe(stage: RecoveryTransactionStage): void | Promise<void>;
}

export type RecoveryCredentialAuthority = BetterAuthCredentialAuthority;
export type RecoveryPasswordAuthority = Pick<BetterAuthPasswordAuthority, "hash">;

export interface RecoveryAbuseAuthority {
  advance(): Promise<void>;
}

type RecoveryInternalAdapter = Pick<
  AuthContext["internalAdapter"],
  "findUserById" | "updateUser" | "findCredentialAccount" | "updateAccount"
>;

export interface RecoveryProofBoundary {
  readonly persistence: CredentialTokenPersistence;
  readonly abuse: RecoveryAbuseAuthority;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly trustedNow: () => Date | Promise<Date>;
  readonly resetFailurePoint?: ResetFailurePoint;
  readonly inTransactionCallback?: () => void | Promise<void>;
  readonly observer?: RecoveryTransactionObserver;
}

const GENERIC_CREDENTIAL_FAILURE = {
  verified: false,
  failure: "GENERIC_CREDENTIAL_FAILURE",
} as const;

function credentialLifetime(purpose: CredentialTokenPurpose): number {
  return purpose === "EMAIL_VERIFICATION"
    ? EMAIL_VERIFICATION_LIFETIME_MS
    : PASSWORD_RESET_LIFETIME_MS;
}

function validateDigestKeys(capabilityKey: Uint8Array, targetEmailKey: Uint8Array): void {
  if (capabilityKey.byteLength < 32 || targetEmailKey.byteLength < 32) {
    throw new Error("STOP_H6_DIGEST_KEY_INVALID");
  }
  if (capabilityKey.byteLength === targetEmailKey.byteLength
    && timingSafeEqual(Buffer.from(capabilityKey), Buffer.from(targetEmailKey))) {
    throw new Error("STOP_H6_DIGEST_KEYS_MUST_BE_DISTINCT");
  }
}

function lengthPrefixed(parts: readonly Uint8Array[]): Buffer {
  const framed: Buffer[] = [];
  for (const part of parts) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(part.byteLength);
    framed.push(length, Buffer.from(part));
  }
  return Buffer.concat(framed);
}

function keyedDigest(key: Uint8Array, parts: readonly Uint8Array[]): string {
  return createHmac("sha256", key).update(lengthPrefixed(parts)).digest("base64url");
}

function utf8(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function normalizeAccountIdentifier(value: string): string {
  if (/\p{Cc}/u.test(value)) throw new Error("STOP_H6_PROVIDER_EMAIL_INVALID");
  const normalized = value.trim().normalize("NFC").toLowerCase();
  if (Buffer.byteLength(normalized, "utf8") > 254) throw new Error("STOP_H6_PROVIDER_EMAIL_INVALID");
  const parts = normalized.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("STOP_H6_PROVIDER_EMAIL_INVALID");
  const domain = domainToASCII(parts[1]);
  if (!domain) throw new Error("STOP_H6_PROVIDER_EMAIL_INVALID");
  return `${parts[0]}@${domain.toLowerCase()}`;
}

function capabilityBytes(deliveryCapability: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(deliveryCapability)) return null;
  const decoded = Buffer.from(deliveryCapability, "base64url");
  if (decoded.byteLength !== CREDENTIAL_CAPABILITY_BYTES) return null;
  return decoded.toString("base64url") === deliveryCapability ? decoded : null;
}

function tokenDigest(
  key: Uint8Array,
  purpose: CredentialTokenPurpose,
  decodedCapability: Uint8Array,
): string {
  return keyedDigest(key, [
    utf8("passvero-auth-credential-capability"),
    utf8("v1"),
    utf8(purpose),
    decodedCapability,
  ]);
}

function targetEmailDigest(
  key: Uint8Array,
  purpose: CredentialTokenPurpose,
  normalizedEmail: string,
): string {
  return keyedDigest(key, [
    utf8("passvero-auth-credential-target-email"),
    utf8("v1"),
    utf8(purpose),
    utf8(normalizedEmail),
  ]);
}

function equalCanonicalDigests(left: string, right: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(left) || !/^[A-Za-z0-9_-]{43}$/.test(right)) return false;
  const leftBytes = Buffer.from(left, "base64url");
  const rightBytes = Buffer.from(right, "base64url");
  return leftBytes.byteLength === 32 && rightBytes.byteLength === 32
    && timingSafeEqual(leftBytes, rightBytes);
}

function bindBetterAuthOwnerLock(
  persistence: CredentialTokenPersistence,
  internalAdapter: RecoveryInternalAdapter,
  observer?: RecoveryTransactionObserver,
): CredentialTokenStore {
  return {
    ...persistence,
    lockOwner: async (providerUserId) => {
      const current = await internalAdapter.findUserById(providerUserId);
      if (!current) return null;
      const locked = await internalAdapter.updateUser(providerUserId, { email: current.email });
      if (locked.id !== current.id || locked.email !== current.email) {
        throw new Error("STOP_H6_PROVIDER_OWNER_LOCK_INVALID");
      }
      await observer?.observe("OWNER_LOCKED");
      return {
        id: locked.id,
        email: locked.email,
        emailVerified: locked.emailVerified,
      };
    },
  };
}

export function recoveryProofPlugin(boundary: RecoveryProofBoundary) {
  const issueSchema = z.object({
    providerUserId: z.string().min(1),
    purpose: z.enum(["EMAIL_VERIFICATION", "PASSWORD_RESET"]),
  }).strict();
  const presentationSchema = z.object({
    deliveryCapability: z.string().min(1),
  }).strict();
  const resetSchema = presentationSchema.extend({
    replacementPassword: z.string().min(8),
  }).strict();
  const changeSchema = z.object({
    providerUserId: z.string().min(1),
    currentSessionId: z.string().min(1),
    presentedToken: z.string().min(16),
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    rotatedToken: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
  }).strict();
  const probeSchema = z.object({ providerUserId: z.string().min(1) }).strict();

  return {
    id: "passvero-recovery-transaction-proof",
    endpoints: {
      issueCredentialTokenProof: createAuthEndpoint.serverOnly({
        method: "POST",
        body: issueSchema,
      }, async (ctx) => issueCredentialToken({
        store: bindBetterAuthOwnerLock(boundary.persistence, ctx.context.internalAdapter, boundary.observer),
        providerUserId: ctx.body.providerUserId,
        purpose: ctx.body.purpose,
        now: await boundary.trustedNow(),
        capabilityKey: boundary.capabilityKey,
        targetEmailKey: boundary.targetEmailKey,
        observer: boundary.observer,
      })),
      verifyEmailCredentialProof: createAuthEndpoint.serverOnly({
        method: "POST",
        body: presentationSchema,
      }, async (ctx) => verifyEmailWithCredentialToken({
        store: bindBetterAuthOwnerLock(boundary.persistence, ctx.context.internalAdapter, boundary.observer),
        providerAdapter: ctx.context.adapter,
        abuse: boundary.abuse,
        deliveryCapability: ctx.body.deliveryCapability,
        now: await boundary.trustedNow(),
        capabilityKey: boundary.capabilityKey,
        targetEmailKey: boundary.targetEmailKey,
        inTransactionCallback: boundary.inTransactionCallback,
        observer: boundary.observer,
      })),
      resetPasswordCredentialProof: createAuthEndpoint.serverOnly({
        method: "POST",
        body: resetSchema,
      }, async (ctx) => resetPasswordWithCredentialToken({
        store: bindBetterAuthOwnerLock(boundary.persistence, ctx.context.internalAdapter, boundary.observer),
        credentialAuthority: ctx.context.internalAdapter,
        password: ctx.context.password,
        sessionAdapter: ctx.context.adapter,
        abuse: boundary.abuse,
        deliveryCapability: ctx.body.deliveryCapability,
        replacementPassword: ctx.body.replacementPassword,
        now: await boundary.trustedNow(),
        capabilityKey: boundary.capabilityKey,
        targetEmailKey: boundary.targetEmailKey,
        failurePoint: boundary.resetFailurePoint ?? "NONE",
        inTransactionCallback: boundary.inTransactionCallback,
        observer: boundary.observer,
      })),
      changePasswordCredentialProof: createAuthEndpoint.serverOnly({
        method: "POST",
        body: changeSchema,
      }, async (ctx) => {
        const sessions = await ctx.context.adapter.findMany<SessionProofRecord>({
          model: "session",
          where: [
            { field: "id", operator: "eq", value: ctx.body.currentSessionId },
            { field: "userId", operator: "eq", value: ctx.body.providerUserId },
            { field: "token", operator: "eq", value: ctx.body.presentedToken },
          ],
        });
        const currentSession = sessions.length === 1 ? sessions[0] : undefined;
        if (!currentSession) throw new Error("STOP_H6_CURRENT_SESSION_NOT_FOUND");
        const now = await boundary.trustedNow();
        const maxAgeSeconds = Math.floor((Math.min(
          currentSession.expiresAt.getTime(),
          currentSession.authenticatedAt.getTime() + 2_592_000_000,
          now.getTime() + 604_800_000,
        ) - now.getTime()) / 1_000);
        if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
          throw new Error("STOP_H6_CURRENT_SESSION_EXPIRED");
        }
        const cookieResponse = new Response(null, { headers: {
          "set-cookie": `__Host-proof=${ctx.body.rotatedToken}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`,
        } });
        const rotated = await runAuthenticatedPasswordChange({
          mutateWithTask7Boundary: () => changePasswordWithBetterAuthAuthority({
            credentialAuthority: ctx.context.internalAdapter,
            password: ctx.context.password,
            sessionAdapter: ctx.context.adapter,
            userId: ctx.body.providerUserId,
            currentPassword: ctx.body.currentPassword,
            newPassword: ctx.body.newPassword,
            currentSession,
            rotatedToken: ctx.body.rotatedToken,
            now,
            cookieResponse,
          }),
          abuse: boundary.abuse,
          inTransactionCallback: boundary.inTransactionCallback,
        });
        await boundary.observer?.observe("CREDENTIAL_UPDATED");
        await boundary.observer?.observe("SESSION_DELETED");
        await boundary.observer?.observe("ABUSE_ADVANCED");
        return {
          changed: true,
          sessionId: rotated.id,
          authenticatedAt: rotated.authenticatedAt,
          lastRefreshAt: rotated.lastRefreshAt,
          expiresAt: rotated.expiresAt,
          selectedOrganizationId: rotated.selectedOrganizationId,
        } as const;
      }),
      afterCommitCredentialProbe: createAuthEndpoint.serverOnly({
        method: "POST",
        body: probeSchema,
      }, async (ctx) => {
        const account = await ctx.context.internalAdapter.findCredentialAccount(ctx.body.providerUserId);
        if (!account?.password) throw new Error("STOP_H6_CREDENTIAL_ACCOUNT_NOT_FOUND");
        await ctx.context.internalAdapter.updateAccount(account.id, { password: account.password });
        return { credentialWriteCommittedBeforeQueuedHook: true } as const;
      }),
    },
  } as const;
}

export async function issueCredentialToken(input: {
  readonly store: CredentialTokenStore;
  readonly providerUserId: string;
  readonly purpose: CredentialTokenPurpose;
  readonly now: Date;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly observer?: RecoveryTransactionObserver;
}): Promise<{
  readonly deliveryCapability: string;
  readonly record: CredentialTokenRecord;
}> {
  validateDigestKeys(input.capabilityKey, input.targetEmailKey);
  const owner = await input.store.lockOwner(input.providerUserId);
  if (!owner) throw new Error("STOP_H6_PROVIDER_OWNER_NOT_FOUND");
  const normalizedEmail = normalizeAccountIdentifier(owner.email);
  const decodedCapability = randomBytes(CREDENTIAL_CAPABILITY_BYTES);
  const deliveryCapability = decodedCapability.toString("base64url");
  await input.store.invalidateActive({
    providerUserId: owner.id,
    purpose: input.purpose,
    at: input.now,
  });
  await input.observer?.observe("PREDECESSORS_INVALIDATED");
  const record: CredentialTokenRecord = {
    id: randomUUID(),
    providerUserId: owner.id,
    purpose: input.purpose,
    tokenDigest: tokenDigest(input.capabilityKey, input.purpose, decodedCapability),
    targetEmailDigest: targetEmailDigest(input.targetEmailKey, input.purpose, normalizedEmail),
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + credentialLifetime(input.purpose)),
    consumedAt: null,
    invalidatedAt: null,
  };
  const inserted = await input.store.create(record);
  await input.observer?.observe("TOKEN_INSERTED");
  return { deliveryCapability, record: inserted };
}

type ConsumeCredentialResult =
  | { readonly accepted: true; readonly record: CredentialTokenRecord; readonly owner: CredentialTokenOwner }
  | { readonly accepted: false };

async function consumeCredentialToken(input: {
  readonly store: CredentialTokenStore;
  readonly purpose: CredentialTokenPurpose;
  readonly deliveryCapability: string;
  readonly now: Date;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly observer?: RecoveryTransactionObserver;
}): Promise<ConsumeCredentialResult> {
  validateDigestKeys(input.capabilityKey, input.targetEmailKey);
  const decoded = capabilityBytes(input.deliveryCapability);
  if (!decoded) return { accepted: false };
  const presentedDigest = tokenDigest(input.capabilityKey, input.purpose, decoded);
  const candidate = await input.store.findByDigest({
    purpose: input.purpose,
    tokenDigest: presentedDigest,
  });
  if (!candidate || candidate.consumedAt || candidate.invalidatedAt || candidate.expiresAt <= input.now) {
    return { accepted: false };
  }
  const owner = await input.store.lockOwner(candidate.providerUserId);
  if (!owner) return { accepted: false };
  const currentTargetDigest = targetEmailDigest(
    input.targetEmailKey,
    input.purpose,
    normalizeAccountIdentifier(owner.email),
  );
  if (!equalCanonicalDigests(currentTargetDigest, candidate.targetEmailDigest)) {
    await input.store.invalidateById({ id: candidate.id, at: input.now });
    return { accepted: false };
  }
  const consumed = await input.store.consumeActive({
    id: candidate.id,
    purpose: input.purpose,
    tokenDigest: presentedDigest,
    now: input.now,
  });
  if (consumed) await input.observer?.observe("TOKEN_CONSUMED");
  return consumed ? { accepted: true, record: consumed, owner } : { accepted: false };
}

export async function verifyEmailWithCredentialToken(input: {
  readonly store: CredentialTokenStore;
  readonly providerAdapter: Pick<DBAdapter, "update">;
  readonly abuse: RecoveryAbuseAuthority;
  readonly deliveryCapability: string;
  readonly now: Date;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly inTransactionCallback?: () => void | Promise<void>;
  readonly observer?: RecoveryTransactionObserver;
}): Promise<
  | { readonly verified: true }
  | typeof GENERIC_CREDENTIAL_FAILURE
> {
  const consumed = await consumeCredentialToken({ ...input, purpose: "EMAIL_VERIFICATION" });
  if (!consumed.accepted) return GENERIC_CREDENTIAL_FAILURE;
  const updated = await input.providerAdapter.update<CredentialTokenOwner>({
    model: "user",
    where: [
      { field: "id", operator: "eq", value: consumed.owner.id },
      { field: "email", operator: "eq", value: consumed.owner.email },
      { field: "emailVerified", operator: "eq", value: false },
    ],
    update: { emailVerified: true },
  });
  if (!updated?.emailVerified) throw new Error("STOP_H6_EMAIL_VERIFICATION_UPDATE_FAILED");
  await input.observer?.observe("PROVIDER_VERIFIED");
  await input.abuse.advance();
  await input.observer?.observe("ABUSE_ADVANCED");
  await input.inTransactionCallback?.();
  return { verified: true };
}

function failAt(actual: ResetFailurePoint, expected: ResetFailurePoint): void {
  if (actual === expected) throw new Error(`INJECTED_H6_${expected}`);
}

export async function resetPasswordWithCredentialToken(input: {
  readonly store: CredentialTokenStore;
  readonly credentialAuthority: RecoveryCredentialAuthority;
  readonly password: RecoveryPasswordAuthority;
  readonly sessionAdapter: Pick<DBAdapter, "findMany" | "delete">;
  readonly abuse: RecoveryAbuseAuthority;
  readonly deliveryCapability: string;
  readonly replacementPassword: string;
  readonly now: Date;
  readonly capabilityKey: Uint8Array;
  readonly targetEmailKey: Uint8Array;
  readonly failurePoint: ResetFailurePoint;
  readonly inTransactionCallback?: () => void | Promise<void>;
  readonly observer?: RecoveryTransactionObserver;
}): Promise<
  | {
      readonly requiresSignIn: true;
      readonly sessionCreated: false;
      readonly cookieEligible: false;
      readonly sessionsRevoked: number;
    }
  | { readonly failure: "GENERIC_CREDENTIAL_FAILURE" }
> {
  const consumed = await consumeCredentialToken({ ...input, purpose: "PASSWORD_RESET" });
  if (!consumed.accepted) return { failure: "GENERIC_CREDENTIAL_FAILURE" };
  failAt(input.failurePoint, "AFTER_CONSUME");
  const account = await input.credentialAuthority.findCredentialAccount(consumed.owner.id);
  if (!account?.password) throw new Error("STOP_H6_CREDENTIAL_ACCOUNT_NOT_FOUND");
  const replacementHash = await input.password.hash(input.replacementPassword);
  await input.credentialAuthority.updateAccount(account.id, { password: replacementHash });
  await input.observer?.observe("CREDENTIAL_UPDATED");
  failAt(input.failurePoint, "AFTER_CREDENTIAL_UPDATE");
  const sessions = await input.sessionAdapter.findMany<{ readonly id: string; readonly userId: string }>({
    model: "session",
    where: [{ field: "userId", operator: "eq", value: consumed.owner.id }],
    select: ["id", "userId"],
    sortBy: { field: "id", direction: "asc" },
  });
  let sessionsRevoked = 0;
  for (const session of sessions) {
    if (session.userId !== consumed.owner.id || !session.id) {
      throw new Error("STOP_H6_SESSION_ENUMERATION_INVALID");
    }
    await input.sessionAdapter.delete({
      model: "session",
      where: [
        { field: "id", operator: "eq", value: session.id },
        { field: "userId", operator: "eq", value: consumed.owner.id },
      ],
    });
    sessionsRevoked += 1;
    await input.observer?.observe("SESSION_DELETED");
    if (sessionsRevoked === 1) failAt(input.failurePoint, "AFTER_PARTIAL_SESSION_DELETION");
  }
  await input.abuse.advance();
  await input.observer?.observe("ABUSE_ADVANCED");
  await input.inTransactionCallback?.();
  failAt(input.failurePoint, "IN_TRANSACTION_CALLBACK");
  return { requiresSignIn: true, sessionCreated: false, cookieEligible: false, sessionsRevoked };
}

export async function runAuthenticatedPasswordChange<T>(input: {
  readonly mutateWithTask7Boundary: () => Promise<T>;
  readonly abuse: RecoveryAbuseAuthority;
  readonly inTransactionCallback?: () => void | Promise<void>;
}): Promise<T> {
  const result = await input.mutateWithTask7Boundary();
  await input.abuse.advance();
  await input.inTransactionCallback?.();
  return result;
}

export async function runRecoveryAfterCommitHook(input: {
  readonly hook: () => void | Promise<void>;
}): Promise<
  | {
      readonly committed: true;
      readonly rolledBack: false;
      readonly retryTransaction: false;
      readonly status: "DELIVERED";
    }
  | {
      readonly committed: true;
      readonly rolledBack: false;
      readonly retryTransaction: false;
      readonly status: "OPERATIONAL_FAILURE";
      readonly category: "RECOVERY_AFTER_COMMIT_HOOK_FAILED";
    }
> {
  try {
    await input.hook();
    return { committed: true, rolledBack: false, retryTransaction: false, status: "DELIVERED" };
  } catch {
    return {
      committed: true,
      rolledBack: false,
      retryTransaction: false,
      status: "OPERATIONAL_FAILURE",
      category: "RECOVERY_AFTER_COMMIT_HOOK_FAILED",
    };
  }
}

export function credentialTokenEvidence(record: CredentialTokenRecord): {
  readonly purpose: CredentialTokenPurpose;
  readonly capabilityDigest: string;
  readonly targetEmailDigest: string;
  readonly lifetimeMs: number;
  readonly consumed: boolean;
  readonly invalidated: boolean;
} {
  return {
    purpose: record.purpose,
    capabilityDigest: record.tokenDigest,
    targetEmailDigest: record.targetEmailDigest,
    lifetimeMs: record.expiresAt.getTime() - record.createdAt.getTime(),
    consumed: record.consumedAt !== null,
    invalidated: record.invalidatedAt !== null,
  };
}

export const H4_CONTROLLED_ACTIVATION_RUNTIME_VERDICT = "NOT_EXECUTED" as const;

export const CONTROLLED_ACTIVATION_FAILURE_POINTS = [
  "NONE",
  "AFTER_PROVIDER_CREDENTIAL_CREATION",
  "AFTER_AUTH_IDENTITY_CREATION",
] as const;

export const ACTIVATION_MATRIX = [
  "VALID_SINGLE_USE",
  "EXPIRED_TOKEN",
  "SUPERSEDED_TOKEN",
  "WRONG_CANONICAL_EMAIL_DIGEST",
  "EXISTING_PROVIDER_EMAIL",
  "EXISTING_PROVIDER_SUBJECT",
  "EXISTING_AUTH_IDENTITY",
  "TWO_CONCURRENT_CONSUMERS",
  "FAIL_AFTER_PROVIDER_CREDENTIAL_CREATION",
  "FAIL_AFTER_AUTH_IDENTITY_CREATION",
] as const;

export const activationSchema = z.object({
  credential: z.string().min(8),
  email: z.email(),
  name: z.string().min(1),
  providerSubject: z.string().min(1),
}).strict();

export function controlledActivationPlugin() {
  return {
    id: "passvero-controlled-activation-proof",
    endpoints: {
      activatePreprovisionedCredential: createAuthEndpoint.serverOnly({
        method: "POST",
        body: activationSchema
      }, async (ctx) => {
        if (ctx.context.options.emailAndPassword?.disableSignUp !== true) {
          throw new Error("STOP_H4_CONTROLLED_AUTH_MUST_DISABLE_SIGNUP");
        }
        const email = ctx.body.email.toLowerCase();
        const passwordHash = await ctx.context.password.hash(ctx.body.credential);
        const user = await ctx.context.internalAdapter.createUser({
          id: ctx.body.providerSubject,
          email,
          emailVerified: false,
          name: ctx.body.name,
        }, { method: "email-password" });
        const account = await ctx.context.internalAdapter.linkAccount({
          userId: user.id,
          providerId: "credential",
          issuer: createLocalAccountIssuer("credential"),
          accountId: user.id,
          password: passwordHash,
        });
        return {
          user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
          account: { id: account.id, providerId: account.providerId, accountId: account.accountId },
        };
      }),
    },
  } as const;
}

export const DISABLED_NATIVE_PATHS = [
  "/account-info",
  "/callback/:id",
  "/change-email",
  "/change-password",
  "/delete-user",
  "/delete-user/callback",
  "/error",
  "/get-access-token",
  "/get-session",
  "/link-social",
  "/list-accounts",
  "/list-sessions",
  "/ok",
  "/refresh-token",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/sign-up/email",
  "/unlink-account",
  "/update-session",
  "/update-user",
  "/verify-email",
  "/verify-password",
] as const;

export interface CreateProofAuthInput {
  readonly prisma: Parameters<typeof prismaAdapter>[0];
  readonly adapterTransaction: boolean;
  readonly disableSignUp: boolean;
  readonly accountUpdateAfter?: () => void | Promise<void>;
}

function proofAuthOptions(input: CreateProofAuthInput) {
  const identity = readRunIdentity();
  const now = () => new Date();

  return {
    appName: "Passvero transaction proof",
    baseURL: "https://auth-proof.invalid/internal-auth",
    basePath: "/internal-auth",
    secret: readAuthSecret(identity),
    database: prismaAdapter(input.prisma, {
      provider: "postgresql",
      transaction: input.adapterTransaction,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: input.disableSignUp,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    session: {
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        authenticatedAt: { type: "date", required: true, input: false },
        lastRefreshAt: { type: "date", required: true, input: false },
        selectedOrganizationId: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const authenticatedAt = now();
            return {
              data: {
                ...session,
                authenticatedAt,
                lastRefreshAt: authenticatedAt,
                selectedOrganizationId: null,
              },
            };
          },
        },
      },
      ...(input.accountUpdateAfter ? {
        account: {
          update: {
            after: async () => input.accountUpdateAfter?.(),
          },
        },
      } : {}),
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
    disabledPaths: [...PRODUCTION_DISABLED_NATIVE_PATHS],
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

export function createProofAuth(input: CreateProofAuthInput) {
  return betterAuth({
    ...proofAuthOptions(input),
    plugins: [controlledActivationPlugin()],
  });
}

export interface CreateRecoveryProofAuthInput extends CreateProofAuthInput {
  readonly recoveryBoundary: RecoveryProofBoundary;
}

export function createRecoveryProofAuth(input: CreateRecoveryProofAuthInput) {
  return betterAuth({
    ...proofAuthOptions(input),
    plugins: [controlledActivationPlugin(), recoveryProofPlugin(input.recoveryBoundary)],
  });
}

export type ProofAuth = ReturnType<typeof createProofAuth>;

export function createControlledActivationAuth(prisma: CreateProofAuthInput["prisma"]) {
  return createProofAuth({ prisma, adapterTransaction: false, disableSignUp: true });
}

export type ControlledActivationApi = ReturnType<typeof createControlledActivationAuth>["api"];
export type RecoveryProofApi = ReturnType<typeof createRecoveryProofAuth>["api"];

export const H7_ROUTE_EXPOSURE_RUNTIME_VERDICT = "NOT_EXECUTED" as const;
export const NATIVE_AUTH_ROUTE_ALLOWLIST = [] as const;

export const ENCODED_DYNAMIC_NATIVE_PATHS = [
  "/callback/:id%2F",
  "/reset-password/:token%2F",
] as const;

export const PRODUCTION_DISABLED_NATIVE_PATHS = [
  ...DISABLED_NATIVE_PATHS,
  ...ENCODED_DYNAMIC_NATIVE_PATHS,
] as const;

export const DIRECT_SERVER_API_ALLOWLIST = [
  "signInEmail",
  "activatePreprovisionedCredential",
  "issueCredentialTokenProof",
  "verifyEmailCredentialProof",
  "resetPasswordCredentialProof",
  "changePasswordCredentialProof",
  "afterCommitCredentialProbe",
] as const satisfies readonly (keyof RecoveryProofApi)[];

export type DirectServerApiEndpoint = (typeof DIRECT_SERVER_API_ALLOWLIST)[number];

export function createRecoveryRouteBoundaryPlugin(boundary: RecoveryProofBoundary) {
  return recoveryProofPlugin(boundary);
}
