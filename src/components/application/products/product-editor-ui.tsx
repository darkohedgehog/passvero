import { MarketingIcon, type MarketingIconName } from "@/src/components/marketing/marketing-icons";

// Local editor presentation only; native button/link semantics and handlers stay at call sites.
export function ProductActionIcon({ name }: Readonly<{ name: MarketingIconName }>) {
  return <MarketingIcon name={name} className="size-4 shrink-0" aria-hidden="true" focusable="false" />;
}

const action = "inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-center text-sm font-semibold whitespace-normal [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
export const editorPrimaryAction = `${action} border border-teal-700 bg-teal-700 text-white shadow-sm hover:bg-teal-800 focus-visible:ring-teal-700`;
export const editorSecondaryAction = `${action} border border-slate-300 bg-white text-slate-800 hover:border-teal-700 hover:bg-slate-50 focus-visible:ring-teal-700`;
export const editorDangerAction = `${action} border border-red-300 bg-red-50 text-red-800 hover:border-red-700 hover:bg-red-100 focus-visible:ring-red-700`;
export const editorInput = "mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100";
