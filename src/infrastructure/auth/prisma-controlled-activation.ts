import type {
  ControlledActivationDependencies,
} from "@/src/application/auth/controlled-activation";
import {
  VerifiedActivationConflict,
  type VerifiedActivationDependencies,
} from "@/src/application/auth/complete-verified-activation";
import {
  Prisma,
  type PrismaClient,
} from "@/src/generated/prisma/client";

type VerifiedTransactionRunner = VerifiedActivationDependencies<
  Prisma.TransactionClient
>["transactionRunner"];
type VerifiedPersistence = VerifiedActivationDependencies<
  Prisma.TransactionClient
>["persistence"];
type ControlledActivationRepository = ControlledActivationDependencies[
  "activationRepository"
];

export class PrismaControlledActivationRepository
implements ControlledActivationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTokenDigest(tokenDigest: string) {
    const activation = await this.prisma.accountActivationIntent.findUnique({
      where: { tokenDigest },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        claimId: true,
        claimExpiresAt: true,
        providerSubject: true,
        intendedEmailDigest: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
    if (activation === null) {
      return null;
    }

    return {
      ...activation,
      user: { ...activation.user, eligible: true },
    };
  }

  async claim(input: {
    readonly intentId: string;
    readonly claimId: string;
    readonly claimedAt: Date;
    readonly claimExpiresAt: Date;
    readonly expectedClaimId: string | null;
  }): Promise<boolean> {
    const result = await this.prisma.accountActivationIntent.updateMany({
      where: input.expectedClaimId === null
        ? { id: input.intentId, status: "ISSUED", claimId: null }
        : {
          id: input.intentId,
          status: "IN_PROGRESS",
          claimId: input.expectedClaimId,
          claimExpiresAt: { lte: input.claimedAt },
        },
      data: {
        status: "IN_PROGRESS",
        claimId: input.claimId,
        claimedAt: input.claimedAt,
        claimExpiresAt: input.claimExpiresAt,
      },
    });
    return result.count === 1;
  }

  async captureProviderSubject(input: {
    readonly intentId: string;
    readonly claimId: string;
    readonly providerSubject: string;
    readonly capturedAt: Date;
  }): Promise<"CAPTURED" | "ALREADY_CAPTURED" | "CONFLICT"> {
    const existing = await this.prisma.accountActivationIntent.findUnique({
      where: { id: input.intentId },
      select: { status: true, claimId: true, providerSubject: true },
    });
    if (existing === null) {
      return "CONFLICT";
    }
    if (existing.providerSubject !== null) {
      return existing.providerSubject === input.providerSubject
        ? "ALREADY_CAPTURED"
        : "CONFLICT";
    }
    if (
      existing.status !== "IN_PROGRESS"
      || existing.claimId !== input.claimId
    ) {
      return "CONFLICT";
    }

    try {
      const result = await this.prisma.accountActivationIntent.updateMany({
        where: {
          id: input.intentId,
          status: "IN_PROGRESS",
          claimId: input.claimId,
          providerSubject: null,
        },
        data: {
          status: "AUTH_ACCOUNT_CREATED",
          providerSubject: input.providerSubject,
          authAccountCreatedAt: input.capturedAt,
          claimId: null,
          claimedAt: null,
          claimExpiresAt: null,
        },
      });
      return result.count === 1 ? "CAPTURED" : "CONFLICT";
    } catch {
      return "CONFLICT";
    }
  }

  async markConflict(input: {
    readonly intentId: string;
    readonly claimId: string;
    readonly conflictAt: Date;
  }): Promise<boolean> {
    const result = await this.prisma.accountActivationIntent.updateMany({
      where: {
        id: input.intentId,
        status: "IN_PROGRESS",
        claimId: input.claimId,
      },
      data: {
        status: "CONFLICT",
        conflictAt: input.conflictAt,
        claimId: null,
        claimedAt: null,
        claimExpiresAt: null,
      },
    });
    return result.count === 1;
  }
}

export class PrismaAuthTransactionRunner
implements VerifiedTransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}

  async run<Result>(
    work: (transaction: Prisma.TransactionClient) => Promise<Result>,
  ): Promise<Result> {
    try {
      return await this.prisma.$transaction((transaction) => work(transaction));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new VerifiedActivationConflict("Identity binding conflict.");
      }
      throw error;
    }
  }
}

export class PrismaVerifiedActivationPersistence
implements VerifiedPersistence {
  async findActivationByProviderSubject(
    transaction: Prisma.TransactionClient,
    providerSubject: string,
  ) {
    const candidate = await transaction.accountActivationIntent.findFirst({
      where: { provider: "BETTER_AUTH", providerSubject },
      select: { id: true, userId: true },
    });
    if (candidate === null) return null;
    // Every completion path locks User -> Intent -> existing identities, then re-reads.
    // The User lock also serializes attempts from distinct intents for that User.
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.userId}::uuid FOR UPDATE`;
    await transaction.$queryRaw`SELECT "id" FROM "AccountActivationIntent" WHERE "id" = ${candidate.id}::uuid FOR UPDATE`;
    await transaction.$queryRaw`SELECT "id" FROM "AuthIdentity"
      WHERE "provider" = 'BETTER_AUTH' AND ("userId" = ${candidate.userId}::uuid OR "providerSubject" = ${providerSubject})
      ORDER BY "id" FOR UPDATE`;
    const activation = await transaction.accountActivationIntent.findFirst({
      where: { provider: "BETTER_AUTH", providerSubject },
      select: {
        id: true,
        userId: true,
        status: true,
        intendedEmailDigest: true,
        providerSubject: true,
        expiresAt: true,
        user: { select: { email: true } },
      },
    });
    if (
      activation === null
      || activation.id !== candidate.id
      || activation.userId !== candidate.userId
      || activation.providerSubject !== providerSubject
      || ![
        "AUTH_ACCOUNT_CREATED",
        "EMAIL_VERIFIED",
        "BOUND",
      ].includes(activation.status)
    ) {
      return null;
    }
    return {
      id: activation.id,
      userId: activation.userId,
      status: activation.status as
        | "AUTH_ACCOUNT_CREATED"
        | "EMAIL_VERIFIED"
        | "BOUND",
      intendedEmailDigest: activation.intendedEmailDigest,
      canonicalEmail: activation.user.email,
      providerSubject,
      expiresAt: activation.expiresAt,
    };
  }

  findIdentityByProviderSubject(
    transaction: Prisma.TransactionClient,
    providerSubject: string,
  ) {
    return transaction.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: "BETTER_AUTH",
          providerSubject,
        },
      },
      select: { id: true, userId: true, revokedAt: true },
    });
  }

  async findIdentityForUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ) {
    const identities = await transaction.authIdentity.findMany({
      where: { provider: "BETTER_AUTH", userId },
      take: 2,
      select: { id: true, providerSubject: true, revokedAt: true },
      orderBy: { id: "asc" },
    });
    if (identities.length > 1) throw new VerifiedActivationConflict("Identity binding conflict.");
    return identities[0] ?? null;
  }

  async createIdentity(
    transaction: Prisma.TransactionClient,
    input: { readonly userId: string; readonly providerSubject: string },
  ) {
    const identity = await transaction.authIdentity.create({
      data: {
        userId: input.userId,
        provider: "BETTER_AUTH",
        providerSubject: input.providerSubject,
      },
      select: { id: true },
    });
    return { identityId: identity.id };
  }

  async markActivationBound(
    transaction: Prisma.TransactionClient,
    input: {
      readonly intentId: string;
      readonly providerSubject: string;
      readonly boundAt: Date;
    },
  ): Promise<boolean> {
    const result = await transaction.accountActivationIntent.updateMany({
      where: {
        id: input.intentId,
        provider: "BETTER_AUTH",
        providerSubject: input.providerSubject,
        status: { in: ["AUTH_ACCOUNT_CREATED", "EMAIL_VERIFIED"] },
        expiresAt: { gt: input.boundAt },
      },
      data: {
        status: "BOUND",
        emailVerifiedAt: input.boundAt,
        boundAt: input.boundAt,
      },
    });
    return result.count === 1;
  }

  async createAuditEvent(
    transaction: Prisma.TransactionClient,
    input: {
      readonly userId: string;
      readonly authIdentityId: string;
      readonly action: "AUTH_IDENTITY_BOUND";
      readonly summary: "Verified authentication identity bound.";
      readonly metadata: { readonly provider: "BETTER_AUTH" };
      readonly correlationId: string;
      readonly occurredAt: Date;
    },
  ): Promise<void> {
    await transaction.authAuditEvent.create({ data: input });
  }
}
