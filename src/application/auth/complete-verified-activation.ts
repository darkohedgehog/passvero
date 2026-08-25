export interface VerifiedActivationDependencies<Transaction> {
  readonly transactionRunner: {
    run<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
  };
  readonly intendedEmailDigester: {
    matches(input: {
      readonly canonicalEmail: string;
      readonly persistedDigest: string;
    }): Promise<boolean>;
  };
  readonly persistence: {
    findActivationByProviderSubject(
      transaction: Transaction,
      providerSubject: string,
    ): Promise<{
      readonly id: string;
      readonly userId: string;
      readonly status: "AUTH_ACCOUNT_CREATED" | "EMAIL_VERIFIED" | "BOUND";
      readonly intendedEmailDigest: string;
      readonly canonicalEmail: string;
    } | null>;
    findIdentityByProviderSubject(
      transaction: Transaction,
      providerSubject: string,
    ): Promise<{
      readonly id: string;
      readonly userId: string;
      readonly revokedAt: Date | null;
    } | null>;
    findIdentityForUser(
      transaction: Transaction,
      userId: string,
    ): Promise<{
      readonly id: string;
      readonly providerSubject: string;
      readonly revokedAt: Date | null;
    } | null>;
    createIdentity(
      transaction: Transaction,
      input: {
        readonly userId: string;
        readonly providerSubject: string;
      },
    ): Promise<{ readonly identityId: string }>;
    markActivationBound(
      transaction: Transaction,
      input: {
        readonly intentId: string;
        readonly providerSubject: string;
        readonly boundAt: Date;
      },
    ): Promise<boolean>;
    createAuditEvent(
      transaction: Transaction,
      input: {
        readonly userId: string;
        readonly authIdentityId: string;
        readonly action: "AUTH_IDENTITY_BOUND";
        readonly summary: "Verified authentication identity bound.";
        readonly metadata: { readonly provider: "BETTER_AUTH" };
        readonly correlationId: string;
        readonly occurredAt: Date;
      },
    ): Promise<void>;
  };
  readonly now: () => Date;
}

export type VerifiedActivationResult =
  | { readonly status: "DENIED" }
  | { readonly status: "BOUND"; readonly userId: string }
  | { readonly status: "ALREADY_BOUND"; readonly userId: string };

const rollback = Symbol("verified-activation-rollback");

export function createVerifiedActivationCompletionService<Transaction>(
  dependencies: VerifiedActivationDependencies<Transaction>,
) {
  return async function complete(
    provider: {
      readonly providerSubject: string;
      readonly email: string;
    },
    correlationId: string,
  ): Promise<VerifiedActivationResult> {
    try {
      return await dependencies.transactionRunner.run(async (transaction) => {
        const activation = await dependencies.persistence
          .findActivationByProviderSubject(
            transaction,
            provider.providerSubject,
          );
        if (
          activation === null
          || activation.canonicalEmail !== provider.email
        ) {
          return { status: "DENIED" } as const;
        }

        const emailMatches = await dependencies.intendedEmailDigester.matches({
          canonicalEmail: activation.canonicalEmail,
          persistedDigest: activation.intendedEmailDigest,
        });
        if (!emailMatches) {
          return { status: "DENIED" } as const;
        }

        const subjectIdentity = await dependencies.persistence
          .findIdentityByProviderSubject(
            transaction,
            provider.providerSubject,
          );
        if (subjectIdentity !== null) {
          if (
            subjectIdentity.revokedAt !== null
            || subjectIdentity.userId !== activation.userId
          ) {
            return { status: "DENIED" } as const;
          }
          if (activation.status === "BOUND") {
            return {
              status: "ALREADY_BOUND",
              userId: activation.userId,
            } as const;
          }
          return finalizeBinding(
            dependencies,
            transaction,
            activation,
            subjectIdentity.id,
            provider.providerSubject,
            correlationId,
          );
        }

        const userIdentity = await dependencies.persistence
          .findIdentityForUser(transaction, activation.userId);
        if (userIdentity !== null) {
          return { status: "DENIED" } as const;
        }

        const identity = await dependencies.persistence.createIdentity(
          transaction,
          {
            userId: activation.userId,
            providerSubject: provider.providerSubject,
          },
        );
        return finalizeBinding(
          dependencies,
          transaction,
          activation,
          identity.identityId,
          provider.providerSubject,
          correlationId,
        );
      });
    } catch (error) {
      if (error === rollback) {
        return { status: "DENIED" };
      }
      throw error;
    }
  };
}

async function finalizeBinding<Transaction>(
  dependencies: VerifiedActivationDependencies<Transaction>,
  transaction: Transaction,
  activation: {
    readonly id: string;
    readonly userId: string;
  },
  identityId: string,
  providerSubject: string,
  correlationId: string,
): Promise<{ readonly status: "BOUND"; readonly userId: string }> {
  const occurredAt = dependencies.now();
  const marked = await dependencies.persistence.markActivationBound(
    transaction,
    {
      intentId: activation.id,
      providerSubject,
      boundAt: occurredAt,
    },
  );
  if (!marked) {
    throw rollback;
  }
  await dependencies.persistence.createAuditEvent(transaction, {
    userId: activation.userId,
    authIdentityId: identityId,
    action: "AUTH_IDENTITY_BOUND",
    summary: "Verified authentication identity bound.",
    metadata: { provider: "BETTER_AUTH" },
    correlationId,
    occurredAt,
  });
  return { status: "BOUND", userId: activation.userId };
}
