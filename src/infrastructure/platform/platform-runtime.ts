import { getAuthPrismaClient } from "@/src/infrastructure/auth/better-auth-server";
import "server-only";
import { createPlatformServices } from "@/src/application/platform/service";
import { resolveCurrentUserFromProviderSession } from "@/src/infrastructure/auth/provider-neutral-session-resolution";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { PrismaPlatform } from "./prisma-platform";
export function getPlatformServices() {
  const persistence = new PrismaPlatform(getProductionPrismaClient(), getAuthPrismaClient());
  return createPlatformServices({resolve:resolveCurrentUserFromProviderSession,authorize:actor=>persistence.authorize(actor),list:(actor,query)=>persistence.list(actor,query),detail:(actor,id)=>persistence.detail(actor,id),accessRequests:(actor,query)=>persistence.accessRequests(actor,query)});
}
