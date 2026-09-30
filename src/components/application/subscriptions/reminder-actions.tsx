"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function ReminderActions({ id, status, receiptConfirmed }: { id: string; status: string; receiptConfirmed: boolean }) {
  const t = useTranslations("SubscriptionReminders"), router = useRouter();
  const [pending, setPending] = useState(false), [result, setResult] = useState("");
  if (status !== "DELIVERY_UNKNOWN" && (status !== "SENT" || receiptConfirmed)) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const values = new FormData(form); setPending(true); setResult("");
    try {
      const response = await fetch("/api/subscription/reminders/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminderId: id, action: values.get("action"), evidenceReference: values.get("evidence") }) });
      if (!response.ok) throw new Error();
      setResult(t("saved")); router.refresh();
    } catch { setResult(t("failure")); } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3 border-t border-slate-200 pt-4"><p className="text-sm text-slate-600">{t("evidenceHint")}</p><label className="block text-sm">{t("evidence")}<input name="evidence" required minLength={8} maxLength={200} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label><label className="block text-sm">{t("resolution")}<select name="action" className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3">{status === "DELIVERY_UNKNOWN" ? <><option value="CONFIRM_ACCEPTED">{t("confirmAccepted")}</option><option value="CONFIRM_NOT_ACCEPTED">{t("confirmNotAccepted")}</option></> : <option value="CONFIRM_RECEIPT">{t("confirmReceipt")}</option>}</select></label><button disabled={pending} className="min-h-11 rounded-lg bg-slate-900 px-4 text-white disabled:opacity-50">{t("save")}</button><p role="status">{result}</p></form>;
}

export function BillingEmailConfirmationForm() {
  const t = useTranslations("SubscriptionReminders"), router = useRouter();
  const [pending, setPending] = useState(false), [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form); setPending(true); setResult("");
    try {
      const response = await fetch("/api/subscription/reminders/confirm-billing-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: values.get("organizationId"), email: values.get("email"), profileRevision: Number(values.get("revision")), evidenceReference: values.get("evidence") }) });
      if (!response.ok) throw new Error(); setResult(t("saved")); form.reset(); router.refresh();
    } catch { setResult(t("failure")); } finally { setPending(false); }
  }
  return <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold">{t("confirmBilling")}</summary><form onSubmit={submit} className="mt-4 max-w-xl space-y-3"><p className="text-sm text-slate-600">{t("billingHint")}</p>{([{ name: "organizationId", label: "organizationId", type: "text" }, { name: "email", label: "email", type: "email" }, { name: "revision", label: "revision", type: "number" }, { name: "evidence", label: "evidence", type: "text" }] as const).map(field => <label key={field.name} className="block text-sm">{t(field.label)}<input name={field.name} type={field.type} required min={field.type === "number" ? 1 : undefined} minLength={field.name === "evidence" ? 8 : undefined} maxLength={field.name === "email" ? 254 : 200} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>)}<label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1" />{t("possessionChecked")}</label><button disabled={pending} className="min-h-11 rounded-lg bg-slate-900 px-4 text-white disabled:opacity-50">{t("save")}</button><p role="status">{result}</p></form></details>;
}
