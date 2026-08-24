import "server-only";

import {
  createCurrentUserResolver,
  type CurrentUserResolution,
} from "@/src/application/auth/resolve-current-user";
import { createBetterAuthSessionReader } from "@/src/infrastructure/auth/better-auth-session-reader";
import { getBetterAuthServer } from "@/src/infrastructure/auth/better-auth-server";
import { PrismaAuthIdentityReader } from "@/src/infrastructure/auth/prisma-auth-identity-reader";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

export async function resolveCurrentUserFromProviderSession(
  headers: Headers,
): Promise<CurrentUserResolution> {
  const auth = getBetterAuthServer();
  const sessionReader = createBetterAuthSessionReader((input) =>
    auth.api.getSession(input)
  );
  const identity = await sessionReader.read(headers);
  const resolveCurrentUser = createCurrentUserResolver({
    identityReader: {
      findByProviderSubject(input) {
        const reader = new PrismaAuthIdentityReader(getProductionPrismaClient());
        return reader.findByProviderSubject(input);
      },
    },
    now: () => new Date(),
  });

  return resolveCurrentUser(identity);
}
