import type { ReactNode, SelectHTMLAttributes } from "react";
import { editorInput } from "@/src/components/application/products/product-editor-ui";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

// The existing Platform Admin surface, typography and icon treatment.
export const reviewPanel = "min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm";
export function ReviewIcon({ name }: { name: MarketingIconName }) {
  return <MarketingIcon name={name} aria-hidden="true" focusable="false" className="size-5 shrink-0" />;
}
export function ReviewHeading({ icon, children }: { icon: MarketingIconName; children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-3"><span className="text-teal-800"><ReviewIcon name={icon}/></span><h3 className="min-w-0 text-base font-bold text-slate-950 [overflow-wrap:anywhere]">{children}</h3></div>;
}
export function ReviewFact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-900 [overflow-wrap:anywhere]">{children}</dd></div>;
}
export function ReviewBadge({ status, children }: { status: string; children: ReactNode }) {
  // SENT is provider acceptance, not inbox receipt: no success icon or delivery claim.
  const tone = ["APPROVED", "ACCEPTED", "PAID"].includes(status) ? "bg-teal-50 text-teal-800 ring-teal-600/20"
    : ["PENDING", "REQUESTED", "OFFERED", "DELIVERY_UNKNOWN", "DELIVERY_IN_PROGRESS", "IN_PROGRESS"].includes(status) ? "bg-amber-50 text-amber-900 ring-amber-600/20"
    : "bg-slate-100 text-slate-700 ring-slate-500/20";
  return <span className={`inline-flex max-w-full rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset [overflow-wrap:anywhere] ${tone}`}>{children}</span>;
}

export function ReviewSelect({className, children, ...props}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <div className="relative min-w-0"><select {...props} className={`${editorInput} appearance-none pr-10 ${className ?? ""}`}>{children}</select><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 text-slate-500"><ReviewIcon name="back"/></span></div>;
}
