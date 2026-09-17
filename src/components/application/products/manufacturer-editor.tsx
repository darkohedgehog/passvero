"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { manufacturerSchema, type Manufacturer, type ManufacturerState } from "@/src/application/products/manufacturer/contracts";
const empty: Manufacturer = { name:"", addressLine1:"", addressLine2:null, city:"", region:null, postalCode:null, countryCode:"", publicEmail:null, website:null };
const fields = ["name","addressLine1","addressLine2","city","region","postalCode","countryCode","publicEmail","website"] as const;
export function ManufacturerEditor({ state, canEdit }: { state: ManufacturerState; canEdit: boolean }) {
  const t = useTranslations("Manufacturer"), router = useRouter();
  const [selected, setSelected] = useState("");
  const [values, setValues] = useState<Manufacturer>(empty);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const operator = state.operators.find(o => o.id === selected);
  const draft = state.draft;
  const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50";
  function submit(operation: "CREATE" | "UPDATE" | "APPLY" | "REMOVE") {
    if (!draft && (operation === "APPLY" || operation === "REMOVE")) return;
    if ((operation === "CREATE" || operation === "UPDATE") && !manufacturerSchema.safeParse(values).success) { setMessage(t("failure")); return; }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/products/${state.productId}/manufacturer`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          operation, expectedProductUpdatedAt:state.updatedAt,
          ...(operation === "APPLY" || operation === "REMOVE" ? {expectedDraftVersionId:draft!.id, expectedDraftUpdatedAt:draft!.updatedAt} : {}),
          ...(operation === "APPLY" || operation === "UPDATE" ? {operatorId:operator?.id, expectedOperatorUpdatedAt:operator?.updatedAt} : {}),
          ...(operation === "CREATE" || operation === "UPDATE" ? {values} : {}),
        }) });
        if (!response.ok) throw new Error();
        setMessage(t("success")); router.refresh();
      } catch { setMessage(t("failure")); }
    });
  }
  return <section className="space-y-4 rounded-xl border border-slate-200 p-5">
    <h3 className="font-semibold">{t("title")}</h3><p className="text-sm text-slate-600">{t("notice")}</p>
    <h4>{t("snapshot")}</h4><ManufacturerPreview value={draft?.snapshot ?? null} empty={t("empty")} />
    {canEdit ? <>
      <label className="block">{t("directory")}<select disabled={pending} value={selected} className="mt-1 block w-full rounded border p-2" onChange={e => { const id=e.target.value; setSelected(id); const row=state.operators.find(o=>o.id===id); setValues(row ? Object.fromEntries(fields.map(f=>[f,row[f]])) as Manufacturer : empty); }}>
        <option value="">{t("new")}</option>{state.operators.map(o=><option key={o.id} value={o.id}>{o.name} — {o.city}, {o.countryCode}</option>)}
      </select></label>
      {operator && draft ? <div className="space-y-2"><ManufacturerPreview value={operator} empty={t("empty")} /><button type="button" disabled={pending} className={button} onClick={()=>submit("APPLY")}>{t("apply")}</button></div> : null}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();submit(operator?"UPDATE":"CREATE");}}>
        {fields.map(field=><label key={field} className="text-sm">{t(field)}<input className="mt-1 block w-full rounded border p-2" disabled={pending} required={["name","addressLine1","city","countryCode"].includes(field)} type={field==="publicEmail"?"email":field==="website"?"url":"text"} maxLength={field==="countryCode"?2:field==="website"?2048:field==="publicEmail"?254:field==="postalCode"?32:field==="city"||field==="region"?100:200} value={values[field]??""} onChange={e=>setValues(v=>({...v,[field]:field==="countryCode"?e.target.value.toUpperCase():e.target.value || (["name","addressLine1","city"].includes(field)?"":null)}))} /></label>)}
        <button className={button} disabled={pending} type="submit">{pending?t("pending"):operator?t("save"):t("create")}</button>
      </form>
      {draft?.snapshot ? <button type="button" className={button} disabled={pending} onClick={()=>submit("REMOVE")}>{t("remove")}</button> : null}
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
export function ManufacturerPreview({ value, empty }: { value: Manufacturer | null; empty: string }) {
  return value ? <div className="space-y-1 text-sm"><p className="font-medium">{value.name}</p><p>{[value.addressLine1,value.addressLine2,value.postalCode,value.city,value.region,value.countryCode].filter(Boolean).join(", ")}</p>{value.publicEmail?<p>{value.publicEmail}</p>:null}{value.website?<p>{value.website}</p>:null}</div> : <p className="text-sm text-slate-500">{empty}</p>;
}
