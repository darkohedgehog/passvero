import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/src/generated/prisma/client";
import type { CommercialActor } from "@/src/application/subscriptions/contracts";
import { commercialError } from "@/src/application/subscriptions/service";
import { lockEntitlementOrganization } from "./entitlement-runtime";

const classification = z.enum(["VOLUNTARY", "MANDATORY", "UNRESOLVED"]);
export const regulatoryCommand = z.object({ productId: z.uuid(), expectedClassification: classification, classification,
  reason: z.string().trim().min(1).max(1000).refine(value => !/[\u0000-\u001f\u007f]/.test(value)) }).strict();
export class RegulatoryService {
  constructor(private readonly db: PrismaClient, private readonly auth: Pick<PrismaClient, "authProviderSession">) {}
  async authorized(tx: Prisma.TransactionClient, actor: CommercialActor) {
    const grant = await tx.platformRegulatoryGrant.findUnique({ where: { userId: actor.currentUser.userId } });
    if (!grant || grant.revokedAt) return false;
    const session = await this.auth.authProviderSession.findUnique({ where: { id: actor.providerSession.providerSessionId }, include: { authprovideruser: { select: { emailVerified: true } } } });
    const now = Date.now();
    return !!session && session.authprovideruser.emailVerified && session.expiresAt.getTime() > now && session.createdAt.getTime()+30*86400000 > now
      && !!await tx.authIdentity.findFirst({ where: { userId: actor.currentUser.userId, provider: "BETTER_AUTH", providerSubject: session.userId, revokedAt: null } });
  }
  async requireAccess(actor: CommercialActor) {
    if (!await this.authorized(this.db, actor)) throw commercialError("REGULATORY_FORBIDDEN", "FORBIDDEN");
  }
  async list(actor: CommercialActor) {
    return this.db.$transaction(async tx => {
      if (!await this.authorized(tx, actor)) throw commercialError("REGULATORY_FORBIDDEN", "FORBIDDEN");
      return tx.product.findMany({ orderBy: { id: "asc" }, take: 100, select: { id: true, internalName: true, regulatoryClassification: true, regulatoryReason: true, organization: { select: { displayName: true } } } });
    });
  }
  async classify(actor: CommercialActor, input: unknown) {
    const parsed = regulatoryCommand.safeParse(input);
    if (!parsed.success) throw commercialError("REGULATORY_INVALID_INPUT", "INVALID_STATE");
    const command = parsed.data;
    await this.requireAccess(actor);
    const owned = await this.db.product.findUnique({ where: { id: command.productId }, select: { organizationId: true } });
    if (!owned) throw commercialError("REGULATORY_NOT_FOUND", "INVALID_STATE");
    return this.db.$transaction(async tx => {
      await lockEntitlementOrganization(tx, owned.organizationId);
      if (!await this.authorized(tx, actor)) throw commercialError("REGULATORY_FORBIDDEN", "FORBIDDEN");
      const product = await tx.product.findFirst({ where: { id: command.productId, organizationId: owned.organizationId } });
      if (!product) throw commercialError("REGULATORY_NOT_FOUND", "INVALID_STATE");
      if (product.regulatoryClassification === command.classification && product.regulatoryReason === command.reason && product.regulatoryClassifiedById === actor.currentUser.userId) return { status: "NO_CHANGE" };
      if (product.regulatoryClassification !== command.expectedClassification) throw commercialError("REGULATORY_CONFLICT");
      await tx.product.update({ where: { id: product.id }, data: { regulatoryClassification: command.classification, regulatoryReason: command.reason, regulatoryClassifiedById: actor.currentUser.userId, regulatoryClassifiedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: product.organizationId, actorId: actor.currentUser.userId, action: "PRODUCT_REGULATORY_CLASSIFICATION_CHANGED", entityType: "PRODUCT", entityId: product.id,
        metadata: { previous: product.regulatoryClassification, current: command.classification, reason: command.reason }, correlationId: randomUUID() } });
      return { status: "UPDATED" };
    });
  }
}
