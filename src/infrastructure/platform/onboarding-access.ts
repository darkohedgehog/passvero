import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";
import type { PlatformActor } from "@/src/application/platform/service";
import { hasPlatformAccess } from "./prisma-platform";
export async function hasOnboardingAccess(tx: Prisma.TransactionClient, actor: PlatformActor, auth: Pick<PrismaClient, "authProviderSession">) {
  const grant = await tx.platformOnboardingGrant.findUnique({ where: { userId: actor.currentUser.userId }, select: { revokedAt: true } });
  return !!grant && grant.revokedAt === null && await hasPlatformAccess(tx, actor, auth);
}
