import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { createGetPublicDppService } from "@/src/application/public-dpp/get-public-dpp";
import { QRCODE_ACTIVATED } from "@/src/application/products/qr/contracts";
import type { ProductQrPersistence, ProductQrRecord, QrTransactionMode } from "@/src/application/products/qr/ports";
import { PrismaPublicDppPersistence } from "./prisma-public-dpp";

export class PrismaProductQrTransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}
  run<Result>(mode: QrTransactionMode, work: (tx: Prisma.TransactionClient) => Promise<Result>): Promise<Result> {
    return this.prisma.$transaction(work, { isolationLevel: mode === "READ" ? "RepeatableRead" : "ReadCommitted" });
  }
}

export class PrismaProductQrPersistence implements ProductQrPersistence<Prisma.TransactionClient> {
  async readEligibility(tx: Prisma.TransactionClient, context: AuthenticatedUserContext, mode: QrTransactionMode) {
    if (mode === "ACTIVATE") {
      // Shared locks prevent eligibility changes until the QR audit commits.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId}::uuid FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Membership" WHERE "id" = ${context.membershipId}::uuid AND "userId" = ${context.userId}::uuid AND "organizationId" = ${context.organizationId}::uuid FOR SHARE`);
    }
    const row = await tx.membership.findFirst({
      where: { id: context.membershipId, userId: context.userId, organizationId: context.organizationId },
      select: { status: true, role: true, organization: { select: { status: true } } },
    });
    return row === null ? null : { membershipRole: row.role, membershipStatus: row.status, organizationStatus: row.organization.status };
  }

  async readProduct(tx: Prisma.TransactionClient, productId: string, organizationId: string, mode: QrTransactionMode): Promise<ProductQrRecord | null> {
    if (mode === "ACTIVATE") {
      // Publication takes the same Product lock. Locking does not touch updatedAt.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${productId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`);
    }
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true, organizationId: true, lifecycleStatus: true, publicCode: true, currentPublishedVersionId: true },
    });
    if (product === null) return null;
    if (mode === "ACTIVATE") {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Passport" WHERE "productId" = ${product.id}::uuid FOR SHARE`);
    }
    const passports = await tx.passport.findMany({
      where: { productId: product.id }, take: 2,
      select: { id: true, productId: true, organizationId: true, status: true },
    });
    const resolvedPassports = [];
    for (const passport of passports) {
      if (mode === "ACTIVATE") {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "QRCode" WHERE "passportId" = ${passport.id}::uuid FOR UPDATE`);
      }
      const qrCodes = await tx.qRCode.findMany({
        where: { passportId: passport.id }, take: 2,
        select: { id: true, passportId: true, code: true, targetUrl: true, status: true, generatedAt: true, activatedAt: true, revokedAt: true, createdAt: true, updatedAt: true },
      });
      resolvedPassports.push({ ...passport, qrCodes });
    }
    if (mode === "ACTIVATE" && product.currentPublishedVersionId !== null) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ProductVersion" WHERE "id" = ${product.currentPublishedVersionId}::uuid AND "productId" = ${productId}::uuid AND "organizationId" = ${organizationId}::uuid FOR SHARE`);
    }
    const version = product.currentPublishedVersionId === null ? null : await tx.productVersion.findUnique({
      where: { id: product.currentPublishedVersionId },
      select: { id: true, productId: true, organizationId: true, status: true, sourceLocale: true },
    });
    return { ...product, version, passports: resolvedPassports };
  }

  async publicEligible(tx: Prisma.TransactionClient, publicCode: string, sourceLocale: string): Promise<boolean> {
    const getPublicDpp = createGetPublicDppService({ persistence: new PrismaPublicDppPersistence(tx) });
    const result = await getPublicDpp({ publicCode, requestedLocale: sourceLocale, acceptLanguage: null });
    return result.kind === "PUBLIC";
  }

  async activate(tx: Prisma.TransactionClient, input: Parameters<ProductQrPersistence<Prisma.TransactionClient>["activate"]>[1]): Promise<boolean> {
    const { qr, at, context } = input;
    const changed = await tx.qRCode.updateMany({
      where: { id: qr.id, passportId: qr.passportId, code: qr.code, targetUrl: qr.targetUrl, generatedAt: qr.generatedAt, createdAt: qr.createdAt, updatedAt: qr.updatedAt, status: "PENDING", activatedAt: null, revokedAt: null },
      data: { status: "ACTIVE", activatedAt: at, updatedAt: at },
    });
    if (changed.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId, actorId: context.userId,
        action: QRCODE_ACTIVATED, entityType: "QRCODE", entityId: qr.id,
        summary: "QR code activated.", metadata: { previousStatus: "PENDING", status: "ACTIVE" },
        correlationId: context.correlationId, occurredAt: at,
      }, select: { id: true },
    });
    return true;
  }
}
