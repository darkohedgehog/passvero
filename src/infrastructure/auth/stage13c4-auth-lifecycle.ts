import "server-only";

import { createVerificationBindingRecovery } from "./verification-binding-recovery";

import { randomUUID } from "node:crypto";

import { createAuthenticatedPasswordChangeService } from "@/src/application/auth/change-password";
import { createVerifiedActivationCompletionService } from "@/src/application/auth/complete-verified-activation";
import { createControlledActivationService } from "@/src/application/auth/controlled-activation";
import { createPasswordRecoveryService } from "@/src/application/auth/password-recovery";
import { createActivationDigesters } from "@/src/infrastructure/auth/activation-digests";
import { createLazyAuthEmailSender } from "@/src/infrastructure/auth/auth-email-runtime";
import { getBetterAuthLifecycleProvider, getBetterAuthServer } from "@/src/infrastructure/auth/better-auth-server";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import {
  PrismaAuthTransactionRunner,
  PrismaControlledActivationRepository,
  PrismaVerifiedActivationPersistence,
} from "@/src/infrastructure/auth/prisma-controlled-activation";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

export function createStage13c4AuthLifecycle(input: {
  readonly activationCapabilityKey: Uint8Array;
  readonly activationEmailKey: Uint8Array;
}) {
  const config = validateBetterAuthServerConfig({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
  });
  const prisma = getProductionPrismaClient();
  const emailSender = createLazyAuthEmailSender(config.baseURL);
  const digesters = createActivationDigesters({
    capabilityKey: input.activationCapabilityKey,
    emailKey: input.activationEmailKey,
  });
  const completeVerifiedActivation = createVerifiedActivationCompletionService({
    transactionRunner: new PrismaAuthTransactionRunner(prisma),
    intendedEmailDigester: digesters.intendedEmailDigester,
    persistence: new PrismaVerifiedActivationPersistence(),
    now: () => new Date(),
  });
  const provider = getBetterAuthLifecycleProvider(async (verifiedIdentity) => {
    const result = await completeVerifiedActivation(
      verifiedIdentity,
      randomUUID(),
    );
    if (result.status !== "BOUND" && result.status !== "ALREADY_BOUND") {
      throw new Error("Verified activation completion was denied.");
    }
  });

  const auth = getBetterAuthServer();
  const verifyEmail = createVerificationBindingRecovery({
    secret: config.secret,
    verifyEmail: (token) => auth.api.verifyEmail({ query: { token } }),
    async findUserByEmail(email) {
      const context = await auth.$context;
      const found = await context.internalAdapter.findUserByEmail(email, { includeAccounts: false });
      return found?.user ?? null;
    },
    complete: (identity) => completeVerifiedActivation(identity, randomUUID()),
  });

  return {
    verifyEmail,
    activate: createControlledActivationService({
      ...digesters,
      activationRepository: new PrismaControlledActivationRepository(prisma),
      provider,
      claimIdGenerator: { generate: randomUUID },
      now: () => new Date(),
    }),
    passwordRecovery: createPasswordRecoveryService({ provider }),
    requestEmailVerification: (email: string) =>
      provider.requestEmailVerification(email),
    changePassword: createAuthenticatedPasswordChangeService({
      provider,
      emailSender,
    }),
  };
}
