import { Prisma, type PrismaClient, type ProductImageAsset } from "@/src/generated/prisma/client";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import type { ImagePersistence } from "@/src/application/products/images/ports";
import { imageError, MAX_IMAGE_BYTES, type ImageAsset, type ImageCommand } from "@/src/application/products/images/contracts";
import { authorizeDocumentActor } from "./prisma-document-assets";
import { PrismaTranslationManagementPersistence } from "./prisma-translation-management";
import { DocumentError } from "@/src/application/documents/contracts";
type Tx = Prisma.TransactionClient;
const imageSelect = { id: true, altText: true, asset: { select: { width: true, height: true, state: true, policyVersion: true } } } as const;
function present(rows: readonly { id: string; altText: string | null; asset: { width: number; height: number; state: string; policyVersion: number } }[]) {
  const row = rows.length === 1 ? rows[0] : null;
  return row && row.asset.state === "READY" && row.asset.policyVersion === 1 ? { id: row.id, altText: row.altText, width: row.asset.width, height: row.asset.height } : null;
}
function asset(row: ProductImageAsset): ImageAsset {
  if (row.state !== "READY" || row.policyVersion !== 1 || !["image/jpeg", "image/png"].includes(row.mimeType) || row.sizeBytes <= 0 || row.sizeBytes > MAX_IMAGE_BYTES) throw imageError("NOT_FOUND", "NOT_FOUND");
  return { id: row.id, organizationId: row.organizationId, storageProvider: row.storageProvider, storageBucket: row.storageBucket, storageKey: row.storageKey, mimeType: row.mimeType as ImageAsset["mimeType"], sizeBytes: Number(row.sizeBytes), checksumSha256: row.checksumSha256, width: row.width, height: row.height };
}
export class PrismaProductImagePersistence implements ImagePersistence {
  private readonly existing: PrismaTranslationManagementPersistence;
  constructor(private readonly prisma: PrismaClient) { this.existing = new PrismaTranslationManagementPersistence(prisma); }
  private async run<T>(work: (tx: Tx) => Promise<T>) {
    try { return await this.prisma.$transaction(work); }
    catch (error) {
      if (error instanceof DocumentError && error.code === "FORBIDDEN") throw imageError("FORBIDDEN", "FORBIDDEN");
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw imageError("CONFLICT", "STALE_WRITE");
      throw error;
    }
  }
  private async load(tx: Tx, id: string, ctx: AuthenticatedUserContext, edit: boolean) {
    await authorizeDocumentActor(tx, ctx, edit ? "PRODUCT_EDIT" : "PRODUCT_READ");
    if (edit) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id=${id}::uuid AND "organizationId"=${ctx.organizationId}::uuid FOR UPDATE`);
    const row = await tx.product.findFirst({ where: { id, organizationId: ctx.organizationId }, include: {
      currentDraftVersion: { include: { images: { where: { isPrimary: true }, take: 2, select: imageSelect } } },
      currentPublishedVersion: { include: { images: { where: { isPrimary: true }, take: 2, select: imageSelect } } },
    } });
    if (!row) throw imageError("NOT_FOUND", "NOT_FOUND");
    for (const version of [row.currentDraftVersion, row.currentPublishedVersion]) {
      if (version && (version.productId !== id || version.organizationId !== ctx.organizationId)) throw imageError("NOT_FOUND", "NOT_FOUND");
    }
    return row;
  }
  private async checked(tx: Tx, id: string, command: ImageCommand, ctx: AuthenticatedUserContext) {
    const row = await this.load(tx, id, ctx, true); const draft = row.currentDraftVersion;
    if (row.lifecycleStatus !== "ACTIVE" || !draft || draft.productId !== id || draft.organizationId !== ctx.organizationId || !["DRAFT", "READY_FOR_REVIEW"].includes(draft.status)) throw imageError("INVALID_STATE", "NOT_EDITABLE");
    if (draft.id !== command.expectedDraftVersionId || draft.updatedAt.toISOString() !== command.expectedDraftUpdatedAt || row.updatedAt.toISOString() !== command.expectedProductUpdatedAt) throw imageError("CONFLICT", "STALE_WRITE");
    if (draft.images.length > 1) throw imageError("INVALID_STATE", "AMBIGUOUS_IMAGES");
    return draft;
  }
  check(id: string, command: ImageCommand, ctx: AuthenticatedUserContext) { return this.run(async tx => { await this.checked(tx, id, command, ctx); }); }
  get(id: string, ctx: AuthenticatedUserContext) { return this.run(async tx => {
    const row = await this.load(tx, id, ctx, false); const draft = row.currentDraftVersion;
    return { productId: id, updatedAt: row.updatedAt.toISOString(), editable: row.lifecycleStatus === "ACTIVE" && !!draft && draft.productId === id && draft.organizationId === ctx.organizationId && ["DRAFT", "READY_FOR_REVIEW"].includes(draft.status),
      draft: draft ? { id: draft.id, updatedAt: draft.updatedAt.toISOString(), image: present(draft.images), ambiguous: draft.images.length > 1 } : null,
      published: present(row.currentPublishedVersion?.images ?? []) };
  }); }
  reserve(id: string, command: ImageCommand, ctx: AuthenticatedUserContext, value: ImageAsset) { return this.run(async tx => {
    await this.checked(tx, id, command, ctx);
    await tx.productImageAsset.create({ data: { ...value, originalFilename: value.mimeType === "image/png" ? "image.png" : "image.jpg", fileExtension: value.mimeType === "image/png" ? "png" : "jpg", state: "PENDING", policyVersion: 1 } });
  }); }
  finalize(id: string, command: ImageCommand, ctx: AuthenticatedUserContext, assetId?: string) { return this.run(async tx => {
    const draft = await this.checked(tx, id, command, ctx);
    if (!await this.existing.touch(tx, { productId: id, organizationId: ctx.organizationId, draftId: draft.id, productAt: new Date(command.expectedProductUpdatedAt), draftAt: new Date(command.expectedDraftUpdatedAt), actorId: ctx.userId })) throw imageError("CONFLICT", "STALE_WRITE");
    if (command.operation === "SET") {
      if (!assetId) throw imageError("INTERNAL", "OPERATIONAL_FAILURE");
      const ready = await tx.productImageAsset.updateMany({ where: { id: assetId, organizationId: ctx.organizationId, state: "PENDING", policyVersion: 1 }, data: { state: "READY", uploadedAt: new Date() } });
      if (ready.count !== 1) throw imageError("CONFLICT", "STALE_WRITE");
      const data = { assetId, altText: command.altText || null, isPublic: true, isPrimary: true };
      if (draft.images[0]) await tx.productImage.update({ where: { id: draft.images[0].id }, data });
      else await tx.productImage.create({ data: { ...data, productVersionId: draft.id } });
    } else if (draft.images[0]) await tx.productImage.delete({ where: { id: draft.images[0].id } });
    await tx.auditLog.create({ data: { organizationId: ctx.organizationId, actorId: ctx.userId, action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: id, summary: "Product image updated.", metadata: { operation: `IMAGE_${command.operation}` }, correlationId: ctx.correlationId } });
  }); }
  abandon(id: string, organizationId: string) { return this.run(async tx => {
    const result = await tx.productImageAsset.updateMany({ where: { id, organizationId, state: "PENDING", images: { none: {} } }, data: { state: "ABANDONED" } });
    return result.count === 1;
  }); }
  privateAsset(productId: string, imageId: string, ctx: AuthenticatedUserContext) { return this.run(async tx => {
    const product = await this.load(tx, productId, ctx, false);
    const row = await tx.productImage.findFirst({ where: { id: imageId, productVersion: { productId, organizationId: ctx.organizationId }, asset: { organizationId: ctx.organizationId } }, include: { asset: true } });
    if (!row || ![product.currentDraftVersionId, product.currentPublishedVersionId].includes(row.productVersionId)) throw imageError("NOT_FOUND", "NOT_FOUND");
    return asset(row.asset);
  }); }
  publicAsset(publicCode: string, imageId: string) { return this.run(async tx => {
    const product = await tx.product.findUnique({ where: { publicCode }, include: { organization: true, passport: true, currentPublishedVersion: { include: { images: { where: { isPrimary: true }, take: 2, include: { asset: true } } } } } });
    const version = product?.currentPublishedVersion; const passport = product?.passport;
    const images = version?.images ?? []; const row = images.length === 1 ? images[0] : null;
    if (!product || product.lifecycleStatus !== "ACTIVE" || product.organization.status !== "ACTIVE" || !passport || passport.status !== "ACTIVE" || passport.productId !== product.id || passport.organizationId !== product.organizationId
      || !version || version.status !== "PUBLISHED" || version.productId !== product.id || version.organizationId !== product.organizationId || !version.publishedAt || version.publishedAt.getTime() !== product.lastPublishedAt?.getTime() || version.publishedAt.getTime() !== passport.lastPublishedAt?.getTime()
      || !row || row.id !== imageId || !row.isPublic || row.asset.organizationId !== product.organizationId) throw imageError("NOT_FOUND", "NOT_FOUND");
    return asset(row.asset);
  }); }
}
