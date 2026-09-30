import { shiftCalendarDays } from "./calendar";
import { publicAvailability, resolveEntitlements, type EntitlementInput } from "./entitlements";

export type ReminderThreshold = 30 | 7 | 1 | 0;
export type ReminderDecision = {
  kind: "SUBSCRIPTION" | "PUBLIC_AVAILABILITY";
  revision: string;
  deadline: Date;
  threshold: ReminderThreshold;
  planSlug: string;
  consequence: "LOCKS" | "LOCKED" | "CONDITIONAL" | "GAP" | "PUBLIC_ENDS";
  nextStart: Date | null;
  eligiblePublications: number;
};
/** One latest due window after downtime; expiry is evaluated against the exact UTC instant. */
export function reminderThreshold(deadline: Date, now: Date, includeExpiry: boolean): ReminderThreshold | null {
  if (!Number.isFinite(deadline.getTime()) || !Number.isFinite(now.getTime())) throw new RangeError("Invalid reminder date");
  if (now >= deadline) return includeExpiry ? 0 : null;
  for (const days of [1, 7, 30] as const) if (now >= shiftCalendarDays(deadline, -days)) return days;
  return null;
}
export type ReminderInput = EntitlementInput & {
  conditionalPeriodIds: readonly string[];
  stagingException: boolean;
  eligiblePublications: number;
};
export function reminderDecision(input: ReminderInput): { subscription: ReminderDecision | null; publicAvailability: ReminderDecision | null } {
  const result: ReturnType<typeof reminderDecision> = { subscription: null, publicAvailability: null };
  if (input.stagingException) return result;
  const rights = resolveEntitlements(input);
  if (!rights.end || !rights.start || !rights.planSlug || rights.kind === "NOT_STARTED" || rights.kind === "TRANSITION_REQUIRED") return result;
  const future = [...input.periods].filter(p => p.start > input.now && p.end > rights.end!).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const confirmedContinuation = future && future.start <= rights.end && !input.conditionalPeriodIds.includes(future.id);
  const threshold = reminderThreshold(rights.end, input.now, true);
  if (!confirmedContinuation && threshold !== null) {
    result.subscription = {
      kind: "SUBSCRIPTION", revision: `${rights.periodId ?? `trial:${rights.start.toISOString()}`}:${rights.end.toISOString()}`,
      deadline: rights.end, threshold, planSlug: rights.planSlug,
      consequence: future ? input.conditionalPeriodIds.includes(future.id) ? "CONDITIONAL" : "GAP" : threshold === 0 ? "LOCKED" : "LOCKS",
      nextStart: future?.start ?? null, eligiblePublications: 0,
    };
  }
  const publicState = publicAvailability({ ...input, classification: "VOLUNTARY" });
  const futureBeforePublicEnd = publicState.until && input.periods.some(p => p.start > input.now && p.start <= publicState.until! && !input.conditionalPeriodIds.includes(p.id));
  if (publicState.reason === "PAID_GRACE" && publicState.until && input.eligiblePublications > 0 && !futureBeforePublicEnd) {
    const publicThreshold = reminderThreshold(publicState.until, input.now, false);
    if (publicThreshold !== null) result.publicAvailability = {
      kind: "PUBLIC_AVAILABILITY", revision: `${rights.periodId}:${publicState.until.toISOString()}`,
      deadline: publicState.until, threshold: publicThreshold, planSlug: rights.planSlug,
      consequence: "PUBLIC_ENDS", nextStart: null, eligiblePublications: input.eligiblePublications,
    };
  }
  return result;
}
