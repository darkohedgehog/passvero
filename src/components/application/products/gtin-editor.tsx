"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { GtinState } from "@/src/application/products/gtin/contracts";
import { gtinSchema } from "@/src/application/products/gtin/validation";

export function GtinEditor({ state, canEdit }: { state: GtinState; canEdit: boolean }) {
  const t = useTranslations("Gtin"), router = useRouter();
  const [value, setValue] = useState(state.draft?.gtin ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draft = state.draft;
  if (!draft) return null;
  function submit(operation: "SET" | "REMOVE") {
    if (!draft) return;
    if (operation === "SET" && !gtinSchema.safeParse(value).success) { setMessage(t("invalid")); return; }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/products/${state.productId}/gtin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          operation, expectedProductUpdatedAt: state.updatedAt, expectedDraftVersionId: draft.id, expectedDraftUpdatedAt: draft.updatedAt,
          ...(operation === "SET" ? { value } : {}),
        }) });
        if (!response.ok) { setMessage(t(response.status === 400 ? "invalid" : response.status === 409 ? "stale" : "failure")); return; }
        setMessage(t("success")); router.refresh();
      } catch { setMessage(t("failure")); }
    });
  }
  return <section className="space-y-3 rounded-xl border border-slate-200 p-5">
    <h3 className="font-semibold">{t("title")}</h3><p className="text-sm text-slate-600">{t("notice")}</p>
    {canEdit ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); submit("SET"); }}>
      <label className="block text-sm">{t("number")}<input className="mt-1 block w-full rounded border p-2" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={14} value={value} disabled={pending} onChange={event => setValue(event.target.value)} aria-describedby="gtin-help" /></label>
      <p id="gtin-help" className="text-sm text-slate-600">{t("help")}</p>
      <div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={pending} type="submit">{pending ? t("pending") : t("save")}</button>
        {draft.gtin !== null ? <button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={pending} type="button" onClick={() => submit("REMOVE")}>{t("remove")}</button> : null}</div>
    </form> : <p>{draft.gtin ?? t("empty")}</p>}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
