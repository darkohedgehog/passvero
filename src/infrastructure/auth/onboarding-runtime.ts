import "server-only";
import { createOnboardingServices } from "@/src/application/auth/onboarding-approval";
import { resolveCurrentUserFromProviderSession } from "./provider-neutral-session-resolution";
import { getAuthPrismaClient, getBetterAuthServer } from "./better-auth-server";
import { getProductionPrismaClient } from "../persistence/prisma/production-prisma-runtime";
import { PrismaAccessRequests } from "../persistence/prisma/prisma-access-requests";
import { hasOnboardingAccess } from "../platform/onboarding-access";
import { getCanonicalAppOrigin } from "../config/canonical-app-origin";
import { createLazyAuthEmailSender } from "./auth-email-runtime";
import { ApplicationError } from "@/src/application/errors/application-error";
import { AccessRequestError } from "../persistence/prisma/prisma-access-requests";
import { ProvisioningError } from "@/src/application/auth/operator-provisioning";
export function getOnboardingServices() {
  const db = getProductionPrismaClient();
  const auth = getAuthPrismaClient();
  return createOnboardingServices({
    resolve: resolveCurrentUserFromProviderSession,
    authorize: actor => hasOnboardingAccess(db, actor, auth),
    async approve(actor, id) {
      const requests = new PrismaAccessRequests(db, async (email) => {
        const context = await getBetterAuthServer().$context;
        return Boolean(await context.internalAdapter.findUserByEmail(email, { includeAccounts: false }));
      });
      try {
        return await requests.approveFromPlatform(id, actor, auth, process.env, createLazyAuthEmailSender(getCanonicalAppOrigin()));
      }
      catch (error) {
        if (error instanceof AccessRequestError || error instanceof ProvisioningError)
          throw new ApplicationError("CONFLICT", "ONBOARDING_REQUIRES_OPERATOR", "Review the current request state.", false);
        throw error;
      }
    },
  });
}
