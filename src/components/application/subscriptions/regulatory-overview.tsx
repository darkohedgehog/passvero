"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
type Row = { id: string; internalName: string; regulatoryClassification: string; regulatoryReason: string | null; organization: { displayName: string } };
export function RegulatoryOverview({ rows }: { rows: Row[] }) {
  const t = useTranslations("Regulatory");
  return <section className="space-y-5"><h2 className="text-2xl font-semibold">{t("title")}</h2><p className="text-sm text-slate-600">{t("explanation")}</p><p className="text-sm">{t("limit")}</p>{rows.map(row => <ClassificationForm key={row.id} row={row} />)}</section>;
}
function ClassificationForm({ row }: { row: Row }) {
  const t = useTranslations("Regulatory"); const router = useRouter();
  const [pending, setPending] = useState(false); const [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget); setPending(true); setResult("");
    try {
      const response = await fetch("/api/regulatory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: row.id, expectedClassification: row.regulatoryClassification, classification: form.get("classification"), reason: form.get("reason") }) });
      setResult(response.ok ? t("saved") : t("failed")); if (response.ok) router.refresh();
    } catch { setResult(t("failed")); } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 break-words">
    <h3 className="font-semibold">{row.internalName}</h3><p className="text-sm text-slate-600">{row.organization.displayName}</p><p className="break-all text-xs text-slate-500">{row.id}</p>
    <label className="block text-sm">{t("classification")}<select name="classification" defaultValue={row.regulatoryClassification} className="mt-1 min-h-11 w-full rounded-lg border p-2">{(["UNRESOLVED", "VOLUNTARY", "MANDATORY"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    <label className="block text-sm">{t("reason")}<textarea name="reason" required maxLength={1000} defaultValue={row.regulatoryReason ?? ""} className="mt-1 min-h-24 w-full rounded-lg border p-2" /></label>
    <button disabled={pending} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? t("pending") : t("save")}</button><p role="status" className="text-sm">{result}</p>
  </form>;
}
