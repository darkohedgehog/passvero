import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { readTenantRegulatoryClassification } from "@/src/infrastructure/subscriptions/regulatory-runtime";
export default async function ProductLayout({ children, params }: { children: ReactNode; params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  let classification: string | null = null;
  try { classification = await readTenantRegulatoryClassification(await headers(), productId); } catch { /* Child enforces its existing authorization/error boundary. */ }
  const t = await getTranslations("Regulatory");
  const label = classification === "VOLUNTARY" || classification === "MANDATORY" || classification === "UNRESOLVED" ? classification : null;
  return <>{label ? <aside className="mx-auto max-w-7xl px-4 pt-4 sm:px-6"><div className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><p className="font-semibold">{t("classification")}: {t(label)}</p>{label !== "VOLUNTARY" ? <p className="mt-1 text-slate-600">{t("explanation")}</p> : null}</div></aside> : null}{children}</>;
}
