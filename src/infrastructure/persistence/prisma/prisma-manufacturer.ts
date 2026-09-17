import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import type { ManufacturerDependencies, ManufacturerPersistence } from "@/src/application/products/manufacturer/contracts";
import { manufacturerSelect } from "@/src/application/products/manufacturer/contracts";
import { manufacturerError } from "@/src/application/products/manufacturer/service";
import { authorizeDocumentActor } from "./prisma-document-assets";
import { DocumentError } from "@/src/application/documents/contracts";
import { PrismaTranslationManagementPersistence } from "./prisma-translation-management";
type Tx = Prisma.TransactionClient;
const snapshotSelect = { ...manufacturerSelect, economicOperatorId: true } as const;
export class PrismaManufacturerPersistence implements ManufacturerPersistence<Tx> {
  private readonly existing: PrismaTranslationManagementPersistence;
  constructor(prisma: PrismaClient) { this.existing = new PrismaTranslationManagementPersistence(prisma); }
  async authorize(tx: Tx, context: Parameters<ManufacturerPersistence<Tx>["authorize"]>[1], edit: boolean) {
    try { await authorizeDocumentActor(tx, context, edit ? "PRODUCT_EDIT" : "PRODUCT_READ"); }
    catch (error) { if (error instanceof DocumentError && error.code === "FORBIDDEN") throw manufacturerError("FORBIDDEN", "FORBIDDEN"); throw error; }
  }
  async load(tx: Tx, productId: string, organizationId: string, lock: boolean) {
    if (lock) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id=${productId}::uuid AND "organizationId"=${organizationId}::uuid FOR UPDATE`);
    const row = await tx.product.findFirst({ where: { id: productId, organizationId }, select: {
      id: true, organizationId: true, lifecycleStatus: true, updatedAt: true,
      currentDraftVersion: { select: { id: true, productId: true, organizationId: true, status: true, updatedAt: true, manufacturer: { select: snapshotSelect } } },
      currentPublishedVersion: { select: { manufacturer: { select: manufacturerSelect } } },
    } });
    if (!row) return null;
    const operators = await tx.economicOperator.findMany({ where: { organizationId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { ...manufacturerSelect, id: true, updatedAt: true } });
    const draft = row.currentDraftVersion;
    return { productId: row.id, organizationId: row.organizationId, lifecycleStatus: row.lifecycleStatus, updatedAt: row.updatedAt.toISOString(),
      draft: draft ? { id: draft.id, productId: draft.productId, organizationId: draft.organizationId, status: draft.status, updatedAt: draft.updatedAt.toISOString(), snapshot: draft.manufacturer, operatorId: draft.manufacturer?.economicOperatorId ?? null } : null,
      published: row.currentPublishedVersion?.manufacturer ?? null,
      operators: operators.map(o => ({ ...o, updatedAt: o.updatedAt.toISOString() })) };
  }
  async write(tx: Tx, productId: string, context: Parameters<ManufacturerPersistence<Tx>["write"]>[2], command: Parameters<ManufacturerPersistence<Tx>["write"]>[3]) {
    const organizationId = context.organizationId;
    // UPDATE affects the address book only. APPLY copies exactly the revision previewed by the user.
    let operatorId: string | null = null;
    if (command.operation === "CREATE") {
      operatorId = (await tx.economicOperator.create({ data: { organizationId, ...command.values }, select: { id: true } })).id;
    } else if (command.operation !== "REMOVE") {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "EconomicOperator" WHERE id=${command.operatorId}::uuid AND "organizationId"=${organizationId}::uuid FOR UPDATE`);
      const operator = await tx.economicOperator.findFirst({ where: { id: command.operatorId, organizationId }, select: { ...manufacturerSelect, updatedAt: true } });
      if (!operator) throw manufacturerError("NOT_FOUND", "NOT_FOUND");
      if (operator.updatedAt.toISOString() !== command.expectedOperatorUpdatedAt) throw manufacturerError("CONFLICT", "STALE_WRITE");
      operatorId = command.operatorId;
      if (command.operation === "UPDATE") await tx.economicOperator.update({ where: { id: operatorId }, data: { ...command.values, updatedAt: new Date(Math.max(Date.now(), operator.updatedAt.getTime()+1)) } });
      else {
        const { updatedAt: _updatedAt, ...values } = operator;
        void _updatedAt;
        const data = { organizationId, economicOperatorId: operatorId, ...values };
        await tx.productVersionManufacturer.upsert({ where: { productVersionId: command.expectedDraftVersionId }, create: { productVersionId: command.expectedDraftVersionId, ...data }, update: data });
      }
    } else await tx.productVersionManufacturer.deleteMany({ where: { productVersionId: command.expectedDraftVersionId, organizationId } });
    if (command.operation === "APPLY" || command.operation === "REMOVE") {
      if (!await this.existing.touch(tx, { productId, organizationId, draftId: command.expectedDraftVersionId, productAt: new Date(command.expectedProductUpdatedAt), draftAt: new Date(command.expectedDraftUpdatedAt), actorId: context.userId })) throw manufacturerError("CONFLICT", "STALE_WRITE");
    } else {
      const at = new Date(command.expectedProductUpdatedAt);
      const changed = await tx.product.updateMany({ where: { id: productId, organizationId, lifecycleStatus: "ACTIVE", updatedAt: at }, data: { updatedAt: new Date(Math.max(Date.now(), at.getTime()+1)), updatedById: context.userId } });
      if (changed.count !== 1) throw manufacturerError("CONFLICT", "STALE_WRITE");
    }
    await tx.auditLog.create({ data: { organizationId, actorId: context.userId, action: "PRODUCT_UPDATED", entityType: "PRODUCT", entityId: productId, summary: "Manufacturer data updated.", metadata: { operation: `MANUFACTURER_${command.operation}`, operatorId }, correlationId: context.correlationId } });
  }
}
export function createPrismaManufacturerDependencies(prisma: PrismaClient): ManufacturerDependencies<Tx> {
  return { persistence: new PrismaManufacturerPersistence(prisma), run: work => prisma.$transaction(work) };
}
