import { getTranslations } from "next-intl/server";
import type { RuntimeEntitlements } from "@/src/infrastructure/subscriptions/entitlement-runtime";
export async function EntitlementNotice({ rights }: { rights: RuntimeEntitlements | null }) {
  if (!rights || rights.limits) return null;
  const t = await getTranslations("Subscription");
  const reason = rights.kind === "TRANSITION_REQUIRED" ? "TRANSITION_REQUIRED" : rights.kind === "NOT_STARTED" ? "NOT_STARTED" : "EXPIRED";
  return <aside role="status" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6"><div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">{rights.blockedReasons.length ? t("blockedDowngrade") : t(reason)}</p><p>{t("contentLock")}</p></div></aside>;
}
