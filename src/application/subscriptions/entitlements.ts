import { addCalendarMonths } from "./calendar";
import { limitsSchema } from "./contracts";
import type { z } from "zod";

export type EntitlementLimits = z.infer<typeof limitsSchema>;
export const TRIAL_LIMITS: Readonly<EntitlementLimits> = Object.freeze({
  maxPublishedProducts: 3, maxStoredProducts: 3,
  maxStorageBytes: 100 * 1024 * 1024, maxPdfAttachments: 5,
});
export type TrialWindow = { start: Date; end: Date };
export type EntitlementPeriod = TrialWindow & { id: string; planSlug: string; limits: unknown };
export type EntitlementInput = { now: Date; trial: TrialWindow | null; periods: readonly EntitlementPeriod[] };
export type EntitlementResolution = {
  kind: "TRIAL" | "PAID" | "EXPIRED" | "NOT_STARTED" | "TRANSITION_REQUIRED";
  periodId: string | null;
  planSlug: string | null;
  start: Date | null;
  end: Date | null;
  limits: EntitlementLimits | null;
};

/** Called only with a recorded activation instant, never Organization.createdAt. */
export function trialWindow(activatedAt: Date): TrialWindow {
  return { start: new Date(activatedAt), end: addCalendarMonths(activatedAt, 6) };
}
function validated(input: EntitlementInput) {
  if (!Number.isFinite(input.now.getTime())) throw new RangeError("Invalid entitlement instant");
  const periods = [...input.periods].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const interval of [...periods, ...(input.trial ? [input.trial] : [])]) {
    if (!Number.isFinite(interval.start.getTime()) || !Number.isFinite(interval.end.getTime()) || interval.start >= interval.end) throw new RangeError("Invalid entitlement interval");
  }
  for (let i = 0; i < periods.length; i++) {
    limitsSchema.parse(periods[i].limits);
    if (i && periods[i].start < periods[i - 1].end) throw new RangeError("Overlapping entitlement periods");
  }
  return periods;
}
/** Immutable receipts are authoritative; a delayed Subscription projection cannot extend rights. */
export function resolveEntitlements(input: EntitlementInput): EntitlementResolution {
  const periods = validated(input);
  const current = periods.find(p => p.start <= input.now && input.now < p.end);
  if (current) return { kind: "PAID", periodId: current.id, planSlug: current.planSlug, start: current.start, end: current.end, limits: limitsSchema.parse(current.limits) };
  const previous = periods.filter(p => p.end <= input.now).at(-1);
  if (previous) return { kind: "EXPIRED", periodId: previous.id, planSlug: previous.planSlug, start: previous.start, end: previous.end, limits: null };
  if (input.trial) {
    const { start, end } = input.trial;
    const kind = input.now < start ? "NOT_STARTED" : input.now >= end ? "EXPIRED" : "TRIAL";
    return { kind, periodId: null, planSlug: "trial", start, end, limits: kind === "TRIAL" ? { ...TRIAL_LIMITS } : null };
  }
  return { kind: periods.length ? "NOT_STARTED" : "TRANSITION_REQUIRED", periodId: null, planSlug: null, start: null, end: null, limits: null };
}
export type EntitlementUsage = {
  storedProducts: number;
  occupiedPublishedProducts: number;
  lifetimeCreatedProducts: number;
  storageBytes: number;
  maxPdfAttachmentsPerVersion: number;
};
export type QuotaAddition = { storedProducts?: number; publishedProducts?: number; storageBytes?: number; pdfAttachments?: number; trial?: boolean };
export type QuotaDenial = "STORED_PRODUCT_LIMIT" | "PUBLICATION_LIMIT" | "STORAGE_LIMIT" | "PDF_ATTACHMENT_LIMIT" | "TRIAL_CREATION_LIMIT";
/** Usage includes retained history and unresolved reservations; linking is not storage creation. */
export function quotaDenials(rawLimits: unknown, usage: EntitlementUsage, addition: QuotaAddition): QuotaDenial[] {
  const limits = limitsSchema.parse(rawLimits);
  for (const value of [...Object.values(usage), ...Object.values(addition).filter(v => typeof v === "number")]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid quota usage");
  }
  const exceeds = (used: number, added: number | undefined, limit: number) => used > limit - (added ?? 0);
  const reasons: QuotaDenial[] = [];
  if (exceeds(usage.storedProducts, addition.storedProducts, limits.maxStoredProducts)) reasons.push("STORED_PRODUCT_LIMIT");
  if (exceeds(usage.occupiedPublishedProducts, addition.publishedProducts, limits.maxPublishedProducts)) reasons.push("PUBLICATION_LIMIT");
  if (exceeds(usage.storageBytes, addition.storageBytes, limits.maxStorageBytes)) reasons.push("STORAGE_LIMIT");
  if (exceeds(usage.maxPdfAttachmentsPerVersion, addition.pdfAttachments, limits.maxPdfAttachments)) reasons.push("PDF_ATTACHMENT_LIMIT");
  if (addition.trial && exceeds(usage.lifetimeCreatedProducts, addition.storedProducts, TRIAL_LIMITS.maxStoredProducts)) reasons.push("TRIAL_CREATION_LIMIT");
  return reasons;
}
/** This commercial decision is additional to publication, privacy, integrity and malware gates. */
export function publicAvailability(input: EntitlementInput & { classification: "VOLUNTARY" | "MANDATORY" | "UNRESOLVED" }) {
  const entitlement = resolveEntitlements(input);
  if (input.classification !== "VOLUNTARY") return { allowed: true, reason: "SEPARATE_POLICY_REQUIRED" as const, until: null };
  if (entitlement.kind === "PAID" || entitlement.kind === "TRIAL") return { allowed: true, reason: "ACTIVE" as const, until: entitlement.end };
  const previous = [...input.periods].filter(p => p.end <= input.now).sort((a, b) => b.end.getTime() - a.end.getTime())[0];
  const until = previous ? addCalendarMonths(previous.end, 6) : null;
  return { allowed: until !== null && input.now < until, reason: until !== null && input.now < until ? "PAID_GRACE" as const : "EXPIRED" as const, until };
}
