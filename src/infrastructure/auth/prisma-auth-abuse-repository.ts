import type {
  AuthAbuseRepository,
} from "../../application/auth/auth-abuse-service";
import {
  AUTH_ABUSE_BACKOFF_DECAY_SECONDS,
  AUTH_ABUSE_EXPIRY_SECONDS,
  authAbuseBackoffSeconds,
  type AuthAbuseBucketState,
  type AuthAbuseDimensionPolicy,
} from "../../application/auth/auth-abuse-policy";
import type { AuthAbuseBucketKey } from "../../application/auth/auth-abuse-types";
import {
  Prisma,
  type PrismaClient,
} from "../../generated/prisma/client";

const lockOrder = {
  GLOBAL_ENDPOINT: 0,
  TRUSTED_NETWORK: 1,
  ACCOUNT_IDENTIFIER: 2,
  ACCOUNT_AND_TRUSTED_NETWORK: 3,
} as const;

const serializationRetryDelayMilliseconds = [
  0,
  1,
  2,
  4,
  8,
  16,
  32,
  64,
  128,
  256,
] as const;

type Bucket = Awaited<ReturnType<
  Prisma.TransactionClient["authAbuseBucket"]["upsert"]
>>;

export class PrismaAuthAbuseRepository implements AuthAbuseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordPreAttempt(
    input: Parameters<AuthAbuseRepository["recordPreAttempt"]>[0],
  ): Promise<readonly AuthAbuseBucketState[]> {
    return retrySerializableTransaction(() => this.prisma.$transaction(async (transaction) => {
      const states: AuthAbuseBucketState[] = [];
      for (const key of sortKeys(input.keys)) {
        const locked = await lockBucket(transaction, key, input.now);
        const dimensionPolicy = input.policy[key.dimension];
        const operationNow = latestDate(input.now, locked.lastAttemptAt);
        const windowExpired = operationNow.getTime()
          - locked.windowStartedAt.getTime()
          >= dimensionPolicy.windowSeconds * 1_000;
        const attemptCount = windowExpired ? 1 : locked.attemptCount + 1;
        const failureCount = windowExpired ? 0 : locked.failureCount;
        const activeBlockedUntil = activeBlock(
          locked.blockedUntil,
          operationNow,
        );
        const priorMetric = dimensionPolicy.metric === "ATTEMPTS"
          ? locked.attemptCount
          : locked.failureCount;
        const currentMetric = metricValue(
          dimensionPolicy,
          attemptCount,
          failureCount,
        );
        const crossedAttemptThreshold = dimensionPolicy.metric === "ATTEMPTS"
          && priorMetric < dimensionPolicy.blockThreshold
          && currentMetric >= dimensionPolicy.blockThreshold;
        const effectiveBackoffLevel = dimensionPolicy.metric === "ATTEMPTS"
          ? decayedBackoffLevel(locked, operationNow)
          : locked.backoffLevel;
        const backoffLevel = crossedAttemptThreshold
          ? Math.min(12, effectiveBackoffLevel + 1)
          : effectiveBackoffLevel;
        const thresholdBlock = crossedAttemptThreshold
          ? new Date(
            operationNow.getTime()
            + authAbuseBackoffSeconds[backoffLevel] * 1_000,
          )
          : null;
        const updated = await transaction.authAbuseBucket.update({
          where: uniqueKey(key),
          data: {
            attemptCount,
            failureCount,
            backoffLevel,
            windowStartedAt: windowExpired
              ? operationNow
              : locked.windowStartedAt,
            lastAttemptAt: operationNow,
            blockedUntil: laterDate(activeBlockedUntil, thresholdBlock),
            expiresAt: expiryFrom(operationNow),
          },
        });
        states.push(toState(updated));
      }
      return states;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  async recordOutcome(
    input: Parameters<AuthAbuseRepository["recordOutcome"]>[0],
  ): Promise<void> {
    await retrySerializableTransaction(() => this.prisma.$transaction(async (transaction) => {
      for (const key of sortKeys(input.keys)) {
        const locked = await lockExistingBucket(transaction, key);
        const operationNow = latestDate(input.now, locked.lastAttemptAt);
        if (input.outcome === "SUCCESS") {
          await transaction.authAbuseBucket.update({
            where: uniqueKey(key),
            data: { expiresAt: expiryFrom(operationNow) },
          });
          continue;
        }

        const dimensionPolicy = input.policy[key.dimension];
        const windowExpired = operationNow.getTime()
          - locked.windowStartedAt.getTime()
          >= dimensionPolicy.windowSeconds * 1_000;
        const attemptCount = windowExpired
          ? 1
          : Math.max(1, locked.attemptCount);
        const failureCount = windowExpired ? 1 : locked.failureCount + 1;
        const effectiveBackoffLevel = decayedBackoffLevel(
          locked,
          operationNow,
        );
        const thresholdReached = metricValue(
          dimensionPolicy,
          attemptCount,
          failureCount,
        ) >= dimensionPolicy.blockThreshold;
        const backoffLevel = thresholdReached
          ? Math.min(12, effectiveBackoffLevel + 1)
          : effectiveBackoffLevel;
        const nextBlock = thresholdReached
          ? new Date(
            operationNow.getTime()
            + authAbuseBackoffSeconds[backoffLevel] * 1_000,
          )
          : null;

        await transaction.authAbuseBucket.update({
          where: uniqueKey(key),
          data: {
            attemptCount,
            failureCount,
            backoffLevel,
            windowStartedAt: windowExpired
              ? operationNow
              : locked.windowStartedAt,
            lastFailureAt: operationNow,
            blockedUntil: laterDate(
              activeBlock(locked.blockedUntil, operationNow),
              nextBlock,
            ),
            expiresAt: expiryFrom(operationNow),
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }
}

async function retrySerializableTransaction<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  for (
    let attempt = 0;
    attempt < serializationRetryDelayMilliseconds.length;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error: unknown) {
      const isFinalAttempt = attempt
        === serializationRetryDelayMilliseconds.length - 1;
      if (!isSerializationConflict(error) || isFinalAttempt) {
        throw error;
      }
      await delay(serializationRetryDelayMilliseconds[attempt]);
    }
  }
  throw new Error("Serializable transaction attempt bound is invalid.");
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2034";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sortKeys(
  keys: readonly AuthAbuseBucketKey[],
): readonly AuthAbuseBucketKey[] {
  return [...keys].sort(
    (left, right) => lockOrder[left.dimension] - lockOrder[right.dimension],
  );
}

async function lockBucket(
  transaction: Prisma.TransactionClient,
  key: AuthAbuseBucketKey,
  now: Date,
): Promise<Bucket> {
  return transaction.authAbuseBucket.upsert({
    where: uniqueKey(key),
    create: {
      dimension: key.dimension,
      endpoint: key.endpoint,
      keyDigest: key.keyDigest,
      attemptCount: 0,
      failureCount: 0,
      backoffLevel: 0,
      windowStartedAt: now,
      lastAttemptAt: now,
      lastFailureAt: null,
      blockedUntil: null,
      expiresAt: expiryFrom(now),
    },
    update: { attemptCount: { increment: 0 } },
  });
}

async function lockExistingBucket(
  transaction: Prisma.TransactionClient,
  key: AuthAbuseBucketKey,
): Promise<Bucket> {
  return transaction.authAbuseBucket.update({
    where: uniqueKey(key),
    data: { attemptCount: { increment: 0 } },
  });
}

function uniqueKey(key: AuthAbuseBucketKey) {
  return {
    dimension_endpoint_keyDigest: {
      dimension: key.dimension,
      endpoint: key.endpoint,
      keyDigest: key.keyDigest,
    },
  };
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + AUTH_ABUSE_EXPIRY_SECONDS * 1_000);
}

function activeBlock(blockedUntil: Date | null, now: Date): Date | null {
  return blockedUntil !== null && blockedUntil.getTime() > now.getTime()
    ? blockedUntil
    : null;
}

function laterDate(left: Date | null, right: Date | null): Date | null {
  if (left === null) return right;
  if (right === null) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function latestDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}

function decayedBackoffLevel(bucket: Bucket, now: Date): number {
  const decayAnchor = bucket.lastFailureAt ?? bucket.lastAttemptAt;
  const quietSeconds = Math.max(
    0,
    Math.floor((now.getTime() - decayAnchor.getTime()) / 1_000),
  );
  const decay = Math.floor(
    quietSeconds / AUTH_ABUSE_BACKOFF_DECAY_SECONDS,
  );
  return Math.max(0, bucket.backoffLevel - decay);
}

function metricValue(
  policy: AuthAbuseDimensionPolicy,
  attemptCount: number,
  failureCount: number,
): number {
  return policy.metric === "ATTEMPTS" ? attemptCount : failureCount;
}

function toState(bucket: Bucket): AuthAbuseBucketState {
  return {
    dimension: bucket.dimension,
    attemptCount: bucket.attemptCount,
    failureCount: bucket.failureCount,
    backoffLevel: bucket.backoffLevel,
    blockedUntil: bucket.blockedUntil,
  };
}
