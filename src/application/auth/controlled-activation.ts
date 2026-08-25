import {
  withAcceptedPassword,
  type PasswordPolicyRejectionReason,
} from "@/src/application/auth/password-policy";

export type ActivationStatus =
  | "ISSUED"
  | "IN_PROGRESS"
  | "AUTH_ACCOUNT_CREATED"
  | "EMAIL_VERIFIED"
  | "BOUND"
  | "EXPIRED"
  | "REVOKED"
  | "CONFLICT";

export interface ActivationIntent {
  readonly id: string;
  readonly status: ActivationStatus;
  readonly expiresAt: Date;
  readonly claimId: string | null;
  readonly claimExpiresAt: Date | null;
  readonly providerSubject: string | null;
  readonly intendedEmailDigest: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string | null;
    readonly eligible: boolean;
  } | null;
}

export interface ControlledActivationDependencies {
  readonly capabilityDigester: {
    digest(capability: string): Promise<string | null>;
  };
  readonly intendedEmailDigester: {
    matches(input: {
      readonly canonicalEmail: string;
      readonly persistedDigest: string;
    }): Promise<boolean>;
  };
  readonly activationRepository: {
    findByTokenDigest(tokenDigest: string): Promise<ActivationIntent | null>;
    claim(input: {
      readonly intentId: string;
      readonly claimId: string;
      readonly claimedAt: Date;
      readonly claimExpiresAt: Date;
      readonly expectedClaimId: string | null;
    }): Promise<boolean>;
    captureProviderSubject(input: {
      readonly intentId: string;
      readonly claimId: string;
      readonly providerSubject: string;
      readonly capturedAt: Date;
    }): Promise<"CAPTURED" | "ALREADY_CAPTURED" | "CONFLICT">;
    markConflict(input: {
      readonly intentId: string;
      readonly claimId: string;
      readonly conflictAt: Date;
    }): Promise<boolean>;
  };
  readonly provider: {
    createCredential(input: {
      readonly email: string;
      readonly displayName: string;
      readonly password: string;
    }): Promise<{
      readonly providerSubject: string;
      readonly normalizedEmail: string;
      readonly emailVerified: boolean;
    }>;
    requestEmailVerification(email: string): Promise<void>;
  };
  readonly claimIdGenerator: { generate(): string };
  readonly now: () => Date;
}

export type ControlledActivationResult =
  | { readonly status: "DENIED" }
  | { readonly status: "RETRY_REQUIRED" }
  | { readonly status: "RECONCILIATION_REQUIRED" }
  | { readonly status: "DELIVERY_RETRY_REQUIRED" }
  | { readonly status: "VERIFICATION_PENDING" }
  | { readonly status: "ALREADY_BOUND" }
  | {
    readonly status: "PASSWORD_REJECTED";
    readonly reason: PasswordPolicyRejectionReason;
  };

const CLAIM_LEASE_MILLISECONDS = 5 * 60 * 1_000;

export function createControlledActivationService(
  dependencies: ControlledActivationDependencies,
) {
  return async function activate(input: {
    readonly capability: string;
    readonly password: unknown;
  }): Promise<ControlledActivationResult> {
    const tokenDigest = await dependencies.capabilityDigester
      .digest(input.capability);
    if (tokenDigest === null) {
      return { status: "DENIED" };
    }

    const activation = await dependencies.activationRepository
      .findByTokenDigest(tokenDigest);
    const currentTime = dependencies.now();
    if (
      activation === null
      || activation.user === null
      || !activation.user.eligible
      || activation.expiresAt.getTime() <= currentTime.getTime()
      || isDeniedStatus(activation.status)
    ) {
      return { status: "DENIED" };
    }
    if (activation.status === "BOUND") {
      return { status: "ALREADY_BOUND" };
    }
    const user = activation.user;

    const emailMatches = await dependencies.intendedEmailDigester.matches({
      canonicalEmail: user.email,
      persistedDigest: activation.intendedEmailDigest,
    });
    if (!emailMatches) {
      return { status: "DENIED" };
    }

    if (
      activation.status === "AUTH_ACCOUNT_CREATED"
      && activation.providerSubject !== null
    ) {
      return requestVerification(
        dependencies,
        user.email,
      );
    }
    if (activation.status === "EMAIL_VERIFIED") {
      return { status: "RECONCILIATION_REQUIRED" };
    }
    if (
      activation.status === "IN_PROGRESS"
      && activation.claimExpiresAt !== null
      && activation.claimExpiresAt.getTime() > currentTime.getTime()
    ) {
      return { status: "RETRY_REQUIRED" };
    }

    let operationResult: ControlledActivationResult = {
      status: "RECONCILIATION_REQUIRED",
    };
    const passwordResult = await withAcceptedPassword(
      {
        password: input.password,
        normalizedEmail: user.email,
        displayName: user.displayName,
      },
      async (preparedPassword) => {
        const claimId = dependencies.claimIdGenerator.generate();
        const claimed = await dependencies.activationRepository.claim({
          intentId: activation.id,
          claimId,
          claimedAt: currentTime,
          claimExpiresAt: new Date(
            currentTime.getTime() + CLAIM_LEASE_MILLISECONDS,
          ),
          expectedClaimId: activation.status === "IN_PROGRESS"
            ? activation.claimId
            : null,
        });
        if (!claimed) {
          operationResult = { status: "RETRY_REQUIRED" };
          return;
        }

        let providerIdentity: Awaited<
          ReturnType<ControlledActivationDependencies["provider"]["createCredential"]>
        >;
        try {
          providerIdentity = await dependencies.provider.createCredential({
            email: user.email,
            displayName: user.displayName ?? user.email,
            password: preparedPassword,
          });
        } catch {
          operationResult = { status: "RECONCILIATION_REQUIRED" };
          return;
        }

        if (
          providerIdentity.normalizedEmail !== user.email
          || providerIdentity.emailVerified
        ) {
          await dependencies.activationRepository.markConflict({
            intentId: activation.id,
            claimId,
            conflictAt: dependencies.now(),
          });
          operationResult = { status: "DENIED" };
          return;
        }

        const capture = await dependencies.activationRepository
          .captureProviderSubject({
            intentId: activation.id,
            claimId,
            providerSubject: providerIdentity.providerSubject,
            capturedAt: dependencies.now(),
          });
        if (capture === "CONFLICT") {
          await dependencies.activationRepository.markConflict({
            intentId: activation.id,
            claimId,
            conflictAt: dependencies.now(),
          });
          operationResult = { status: "DENIED" };
          return;
        }

        operationResult = await requestVerification(
          dependencies,
          user.email,
        );
      },
    );

    if (!passwordResult.accepted) {
      return {
        status: "PASSWORD_REJECTED",
        reason: passwordResult.reason,
      };
    }
    return operationResult;
  };
}

async function requestVerification(
  dependencies: ControlledActivationDependencies,
  email: string,
): Promise<ControlledActivationResult> {
  try {
    await dependencies.provider.requestEmailVerification(email);
    return { status: "VERIFICATION_PENDING" };
  } catch {
    return { status: "DELIVERY_RETRY_REQUIRED" };
  }
}

function isDeniedStatus(status: ActivationStatus): boolean {
  return status === "EXPIRED"
    || status === "REVOKED"
    || status === "CONFLICT";
}
