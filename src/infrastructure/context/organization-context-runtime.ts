import "server-only";

import { randomUUID } from "node:crypto";

import { createCurrentUserResolver } from "@/src/application/auth/resolve-current-user";
import { createContextSmokeHandler } from "@/src/application/context/context-smoke";
import {
  createAuthenticatedUserContextResolver,
  createOrganizationSelectionService,
} from "@/src/application/context/resolve-authenticated-user-context";
import { createBetterAuthSessionReader } from "@/src/infrastructure/auth/better-auth-session-reader";
import { getBetterAuthServer } from "@/src/infrastructure/auth/better-auth-server";
import { PrismaAuthIdentityReader } from "@/src/infrastructure/auth/prisma-auth-identity-reader";
import {
  createLazyOrganizationContextRepository,
  PrismaOrganizationContextRepository,
} from "@/src/infrastructure/context/prisma-organization-context-repository";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type ContextSmokeHandler = ReturnType<typeof createContextSmokeHandler>;
const runtimeGlobal = globalThis as typeof globalThis & {
  __passveroContextSmokeHandler?: ContextSmokeHandler;
};

export function getContextSmokeHandler(): ContextSmokeHandler {
  runtimeGlobal.__passveroContextSmokeHandler ??= createContextSmokeHandler({
    resolve: resolveAuthenticatedUserContext,
  });
  return runtimeGlobal.__passveroContextSmokeHandler;
}

export async function resolveAuthenticatedUserContext(headers: Headers) {
  const services = createServices();
  const identity = await services.readSession(headers);
  return services.resolveContext(identity);
}

export async function selectOrganizationForCurrentSession(
  headers: Headers,
  targetOrganizationId: string,
) {
  const services = createServices();
  const identity = await services.readSession(headers);
  return services.selectOrganization(identity, targetOrganizationId);
}

function createServices() {
  const auth = getBetterAuthServer();
  const sessionReader = createBetterAuthSessionReader((input) =>
    auth.api.getSession(input)
  );
  const resolveCurrentUser = createCurrentUserResolver({
    identityReader: {
      findByProviderSubject(input) {
        const reader = new PrismaAuthIdentityReader(getProductionPrismaClient());
        return reader.findByProviderSubject(input);
      },
    },
    now: () => new Date(),
  });
  const repository = createLazyOrganizationContextRepository(() =>
    new PrismaOrganizationContextRepository(getProductionPrismaClient())
  );

  return {
    readSession: (headers: Headers) => sessionReader.read(headers),
    resolveContext: createAuthenticatedUserContextResolver({
      resolveCurrentUser,
      repository,
      correlationId: randomUUID,
    }),
    selectOrganization: createOrganizationSelectionService({
      resolveCurrentUser,
      repository,
    }),
  };
}
