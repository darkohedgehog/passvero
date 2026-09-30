import "server-only";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getAuthPrismaClient } from "@/src/infrastructure/auth/better-auth-server";
import { resolveCurrentUserFromProviderSession } from "@/src/infrastructure/auth/provider-neutral-session-resolution";
import { commercialError } from "@/src/application/subscriptions/service";
import { RegulatoryService } from "./regulatory";
export async function regulatoryActor(headers: Headers) {
  const actor = await resolveCurrentUserFromProviderSession(headers);
  if (actor.status !== "AUTHENTICATED") throw commercialError("REGULATORY_FORBIDDEN", "FORBIDDEN");
  return actor;
}
export function getRegulatoryService() { return new RegulatoryService(getProductionPrismaClient(), getAuthPrismaClient()); }
export async function requireRegulatoryAccess(headers: Headers) { await getRegulatoryService().requireAccess(await regulatoryActor(headers)); }

export async function readTenantRegulatoryClassification(headers: Headers, productId: string) {
  const { resolveProtectedDashboard } = await import("@/src/infrastructure/context/organization-context-runtime");
  const { hasProductPermission } = await import("@/src/application/permissions/product-permissions");
  const { z } = await import("zod");
  if (!z.uuid().safeParse(productId).success) return null;
  const resolved = await resolveProtectedDashboard(headers);
  if (resolved.status !== "RESOLVED" || !hasProductPermission(resolved.context, "PRODUCT_READ")) return null;
  const product = await getProductionPrismaClient().product.findFirst({ where: { id: productId, organizationId: resolved.context.organizationId }, select: { regulatoryClassification: true } });
  return product?.regulatoryClassification ?? null;
}
