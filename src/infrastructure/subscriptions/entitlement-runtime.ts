import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/src/generated/prisma/client";
import { EntitlementError } from "@/src/application/subscriptions/entitlement-error";
import { limitsSchema, snapshotSchema } from "@/src/application/subscriptions/contracts";
import { resolveEntitlements, publicAvailability, quotaDenials, trialWindow, type EntitlementPeriod, type EntitlementResolution, type EntitlementUsage, type QuotaAddition } from "@/src/application/subscriptions/entitlements";

type Tx = Prisma.TransactionClient;
export async function lockEntitlementOrganization(tx: Tx, organizationId: string) {
  // Advisory namespace is shared by quota and commercial writes. Acquire before product/batch locks.
  await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 930147))::text AS locked`);
}
export async function readEntitlementUsage(tx: Tx, organizationId: string): Promise<EntitlementUsage> {
  const [storedProducts, occupiedPublishedProducts, enrollment, bytes, pdf] = await Promise.all([
    tx.product.count({ where: { organizationId } }),
    tx.product.count({ where: { organizationId, currentPublishedVersionId: { not: null } } }),
    tx.organizationEntitlementEnrollment.findUnique({ where: { organizationId } }),
    tx.$queryRaw<{ bytes: bigint }[]>(Prisma.sql`SELECT COALESCE(sum(bytes),0)::bigint AS bytes FROM (
      SELECT "storageProvider", "storageBucket", "storageKey", max("sizeBytes") AS bytes FROM (
        SELECT "storageProvider", "storageBucket", "storageKey", "sizeBytes" FROM "Document" WHERE "organizationId"=${organizationId}::uuid
        UNION ALL SELECT "storageProvider", "storageBucket", "storageKey", "sizeBytes" FROM "ProductImageAsset" WHERE "organizationId"=${organizationId}::uuid
      ) assets GROUP BY "storageProvider", "storageBucket", "storageKey"
    ) objects`),
    tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COALESCE(max(n),0)::bigint AS count FROM (
      SELECT count(*) AS n FROM "ProductDocument" d JOIN "ProductVersion" v ON v.id=d."productVersionId"
      WHERE v."organizationId"=${organizationId}::uuid GROUP BY v.id
    ) versions`),
  ]);
  const storageBytes = Number(bytes[0]?.bytes ?? 0);
  if (!Number.isSafeInteger(storageBytes)) throw new EntitlementError(organizationId, ["STORAGE_LIMIT"]);
  return { storedProducts, occupiedPublishedProducts, lifetimeCreatedProducts: enrollment?.lifetimeCreatedProducts ?? storedProducts,
    storageBytes, maxPdfAttachmentsPerVersion: Number(pdf[0]?.count ?? 0) };
}
export type RuntimeEntitlements = EntitlementResolution & { blockedReasons: string[]; pendingChange: { planSlug: string; startsAt: string; status: string } | null };
async function coverage(tx: Tx, organizationId: string, now: Date) {
  const [enrollment, rows, upgrades] = await Promise.all([
    tx.organizationEntitlementEnrollment.findUnique({ where: { organizationId } }),
    tx.subscriptionPaidPeriod.findMany({ where: { organizationId }, include: { activation: true }, orderBy: { startsAt: "asc" } }),
    tx.subscriptionUpgradeReceipt.findMany({ where: { organizationId, startsAt: { lte: now } }, orderBy: [{ startsAt: "desc" }, { sequence: "desc" }] }),
  ]);
  const periods: EntitlementPeriod[] = [];
  const blockedReasons: string[] = [];
  let pendingChange: RuntimeEntitlements["pendingChange"] = null;
  for (const row of rows) {
    const snapshot = snapshotSchema.parse(row.snapshot);
    let activation = row.activation;
    if (activation?.status === "PENDING" && row.startsAt <= now) {
      const reasons = quotaDenials(snapshot.limits, await readEntitlementUsage(tx, organizationId), {});
      activation = await tx.subscriptionPaidPeriodActivation.update({ where: { periodId: row.id }, data: {
        status: reasons.length ? "BLOCKED_REQUIRES_OPERATOR" : "ACTIVE", reasons, checkedAt: now,
      } });
      await tx.auditLog.create({ data: { organizationId, actorId: null, action: reasons.length ? "SUBSCRIPTION_DOWNGRADE_BLOCKED" : "SUBSCRIPTION_DOWNGRADE_ACTIVATED",
        entityType: "SUBSCRIPTION_PAID_PERIOD", entityId: row.id, metadata: { reasons }, correlationId: randomUUID() } });
    }
    if (activation?.status === "BLOCKED_REQUIRES_OPERATOR") {
      const replaced = rows.some(candidate => {
        const terms = snapshotSchema.parse(candidate.snapshot);
        return terms.version === 2 && terms.changeKind === "REPLACEMENT" && terms.basePeriodId === row.id && candidate.startsAt <= now;
      });
      if (!replaced && row.startsAt <= now && now < row.endsAt) blockedReasons.push(...(Array.isArray(activation.reasons) ? activation.reasons.filter((v): v is string => typeof v === "string") : ["DOWNGRADE_BLOCKED"]));
      pendingChange = { planSlug: row.planSlug, startsAt: row.startsAt.toISOString(), status: activation.status };
      continue; // A blocked financial receipt is neither active coverage nor public grace.
    }
    if (activation?.status === "PENDING") pendingChange = { planSlug: row.planSlug, startsAt: row.startsAt.toISOString(), status: activation.status };
    const upgrade = upgrades.find(u => u.basePeriodId === row.id && now < u.endsAt);
    periods.push({ id: row.id, planSlug: upgrade?.planSlug ?? row.planSlug, start: row.startsAt, end: row.endsAt, limits: snapshotSchema.parse(upgrade?.snapshot ?? row.snapshot).limits });
  }
  return { enrollment, periods, blockedReasons, pendingChange };
}
export async function readEntitlements(tx: Tx, organizationId: string, now?: Date): Promise<RuntimeEntitlements> {
  await lockEntitlementOrganization(tx, organizationId);
  const instant = now ?? new Date();
  const data = await coverage(tx, organizationId, instant);
  const trial = data.enrollment?.trialStartedAt && data.enrollment.trialEndsAt ? { start: data.enrollment.trialStartedAt, end: data.enrollment.trialEndsAt } : null;
  let result = resolveEntitlements({ now: instant, trial, periods: data.periods });
  const e = data.enrollment;
  if (e?.exceptionStartsAt && e.exceptionEndsAt && e.exceptionStartsAt <= instant && instant < e.exceptionEndsAt && !data.blockedReasons.length && result.kind !== "PAID") {
    result = { kind: "PAID", periodId: null, planSlug: "staging-exception", start: e.exceptionStartsAt, end: e.exceptionEndsAt, limits: limitsSchema.parse(e.exceptionLimits) };
  }
  if (data.blockedReasons.length) result = { ...result, kind: "EXPIRED", limits: null };
  await projectEntitlements(tx, organizationId, result);
  return { ...result, blockedReasons: data.blockedReasons, pendingChange: data.pendingChange };
}
export async function assertContentWrite(tx: Tx, organizationId: string, addition: QuotaAddition = {}) {
  const rights = await readEntitlements(tx, organizationId);
  if (!rights.limits) throw new EntitlementError(organizationId, rights.blockedReasons.length ? rights.blockedReasons : [rights.kind === "TRANSITION_REQUIRED" ? "SUBSCRIPTION_TRANSITION_REQUIRED" : "SUBSCRIPTION_EXPIRED"]);
  const usage = await readEntitlementUsage(tx, organizationId);
  // Ordinary edits must remain possible when a future downgrade requires quota reduction.
  const reasons = quotaDenials(rights.limits, usage, { ...addition, trial: rights.kind === "TRIAL" && !!addition.storedProducts });
  const relevant = reasons.filter(reason => reason === "STORED_PRODUCT_LIMIT" ? !!addition.storedProducts
    : reason === "PUBLICATION_LIMIT" ? !!addition.publishedProducts : reason === "STORAGE_LIMIT" ? !!addition.storageBytes
    : reason === "PDF_ATTACHMENT_LIMIT" ? addition.pdfAttachments !== undefined : true);
  if (relevant.length) throw new EntitlementError(organizationId, relevant);
  return rights;
}
export async function assertPdfAttachment(tx: Tx, organizationId: string, versionId: string, addition: number) {
  const rights = await assertContentWrite(tx, organizationId);
  const count = await tx.productDocument.count({ where: { productVersionId: versionId, productVersion: { organizationId } } });
  if (!rights.limits || count + addition > rights.limits.maxPdfAttachments) throw new EntitlementError(organizationId, ["PDF_ATTACHMENT_LIMIT"]);
}
export async function allowsPublicProduct(tx: Tx, organizationId: string, classification: string) {
  await lockEntitlementOrganization(tx, organizationId);
  const now = new Date();
  const data = await coverage(tx, organizationId, now);
  const trial = data.enrollment?.trialStartedAt && data.enrollment.trialEndsAt ? { start: data.enrollment.trialStartedAt, end: data.enrollment.trialEndsAt } : null;
  if (!["VOLUNTARY", "MANDATORY", "UNRESOLVED"].includes(classification)) return false;
  return publicAvailability({ now, trial, periods: data.periods, classification: classification as "VOLUNTARY" | "MANDATORY" | "UNRESOLVED" }).allowed;
}
export async function activateOrganizationTrial(tx: Tx, organizationId: string, at: Date) {
  await lockEntitlementOrganization(tx, organizationId);
  if (await tx.organizationEntitlementEnrollment.findUnique({ where: { organizationId } })) return;
  const trial = trialWindow(at);
  await tx.organizationEntitlementEnrollment.create({ data: { organizationId, enrolledAt: at, trialStartedAt: trial.start, trialEndsAt: trial.end,
    lifetimeCreatedProducts: await tx.product.count({ where: { organizationId } }), reason: "Verified organization activation" } });
  await tx.auditLog.create({ data: { organizationId, actorId: null, action: "SUBSCRIPTION_TRIAL_STARTED", entityType: "ORGANIZATION", entityId: organizationId,
    metadata: { startsAt: trial.start.toISOString(), endsAt: trial.end.toISOString() }, correlationId: randomUUID() } });
}
/** Persist a due blocked transition even when a denied mutation rolls its own transaction back. */
export async function persistEntitlementDenial(db: PrismaClient, error: unknown) {
  if (error instanceof EntitlementError) await db.$transaction(tx => readEntitlements(tx, error.organizationId));
}

async function projectEntitlements(tx: Tx, organizationId: string, rights: EntitlementResolution) {
  if (!rights.start || !rights.end || !rights.planSlug || rights.planSlug === "staging-exception" || rights.kind === "NOT_STARTED") return;
  const plan = await tx.plan.findUnique({ where: { slug: rights.planSlug }, select: { id: true } });
  if (!plan) throw new EntitlementError(organizationId, ["SUBSCRIPTION_CATALOG_INVALID"]);
  const status: "TRIAL" | "ACTIVE" | "EXPIRED" = rights.kind === "TRIAL" ? "TRIAL" : rights.kind === "PAID" ? "ACTIVE" : "EXPIRED";
  const current = await tx.subscription.findUnique({ where: { organizationId } });
  if (current && current.planId === plan.id && current.status === status && current.currentPeriodStart.getTime() === rights.start.getTime() && current.currentPeriodEnd.getTime() === rights.end.getTime()) return;
  const data = { planId: plan.id, status, billingProvider: "MANUAL" as const, currentPeriodStart: rights.start, currentPeriodEnd: rights.end,
    cancelAtPeriodEnd: false, canceledAt: status === "EXPIRED" ? rights.end : null, externalCustomerId: null, externalSubscriptionId: null, providerConfigurationKey: null };
  await tx.subscription.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
  await tx.auditLog.create({ data: { organizationId, actorId: null, action: "SUBSCRIPTION_ENTITLEMENTS_PROJECTED", entityType: "ORGANIZATION", entityId: organizationId,
    metadata: { status, planSlug: rights.planSlug, periodId: rights.periodId }, correlationId: randomUUID() } });
}

export async function runEntitlementTransaction<T>(db: PrismaClient, work: (tx: Tx) => Promise<T>, options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T> {
  try { return await db.$transaction(work, options); }
  catch (error) { await persistEntitlementDenial(db, error); throw error; }
}
