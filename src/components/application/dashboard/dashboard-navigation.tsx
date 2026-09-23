"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/src/i18n/navigation";
import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

export function isDashboardNavActive(path: string, target: string) {
  return target === "/dashboard" ? path === target : path === target || path.startsWith(target + "/");
}
export function DashboardNavigation({ canReadProducts, canReadBilling = false }: { canReadProducts: boolean; canReadBilling?: boolean }) {
  const t = useTranslations("DashboardOverview");
  const billing = useTranslations("BillingProfile");
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { dialog.current?.close(); }
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const changed = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", changed);
    return () => desktop.removeEventListener("change", changed);
  }, []);
  const links = <nav aria-label={t("navigation")} className="mt-10 space-y-2">
    {([{ href: "/dashboard", label: t("overview"), icon: "analytics" }, ...(canReadProducts ? [{ href: "/dashboard/products", label: t("products"), icon: "packaging" as const }, { href: "/dashboard/dpp", label: "DPP", icon: "document" as const }] : []), ...(canReadBilling ? [{href:"/dashboard/billing",label:billing("title"),icon:"receipt" as const}] : [])] satisfies readonly {href:string;label:string;icon:MarketingIconName}[]).map(item => <Link key={item.href} href={item.href} onClick={close}
      aria-current={isDashboardNavActive(pathname, item.href) ? "page" : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${isDashboardNavActive(pathname, item.href) ? "bg-navy-800 text-white ring-1 ring-white/15" : "text-slate-300 hover:bg-navy-800 hover:text-white"}`}>
      <MarketingIcon name={item.icon} aria-hidden="true" focusable="false" className="size-5 shrink-0" />{item.label}
    </Link>)}
  </nav>;
  const brand = <Link href="/dashboard" onClick={close} className="inline-flex min-h-11 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"><BrandLogo label="Passvero" inverse /></Link>;
  return <>
    <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:text-slate-950">{t("skip")}</a>
    <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto bg-navy-950 px-5 py-7 lg:block">{brand}{links}</aside>
    <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-controls="dashboard-mobile-menu" onClick={() => dialog.current?.showModal()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16" /></svg>{t("menu")}
      </button>
    </div>
    <dialog ref={dialog} id="dashboard-mobile-menu" aria-label={t("navigation")} onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) close(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 bg-navy-950 p-0 text-white backdrop:bg-slate-950/50">
      <div className="min-h-full p-5"><div className="flex items-center justify-between gap-2">{brand}<button type="button" onClick={close} aria-label={t("closeMenu")} className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">×</button></div>{links}</div>
    </dialog>
  </>;
}
