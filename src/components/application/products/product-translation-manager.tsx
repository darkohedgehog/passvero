"use client";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PASSVERO_LOCALES, type PassveroLocale } from "@/src/domain/values/passvero-locale";
import { canLeaveTranslation, emptyTranslation, translationReady, TRANSLATION_TEXT_FIELDS, type TranslationContent, type TranslationTextField } from "@/src/application/products/translation-management/content";
import type { TranslationEvidence, TranslationRow } from "@/src/application/products/translation-management/contracts";

export interface TranslationLabels {
  title: string; source: string; missing: string; incomplete: string; ready: string; published: string;
  add: string; save: string; remove: string; confirmRemove: string; discard: string; pending: string;
  failure: string; conflict: string; validation: string; reload: string; sourceName: string; empty: string;
  readOnly: string; privateDraft: string; productName: string;
  fields: Record<TranslationTextField,string>;
  languages: Record<PassveroLocale,string>;
}
export interface TranslationManagerData {
  productId: string; sourceLocale: string; published: boolean; canEdit: boolean;
  translations: readonly (Omit<TranslationRow,"updatedAt"> & {updatedAt:string})[];
  evidence: TranslationEvidence;
}
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50";
export function ProductTranslationManager({data,labels,baseEditHref}: Readonly<{data:TranslationManagerData;labels:TranslationLabels;baseEditHref:string}>) {
  const [selected,setSelected] = useState(data.sourceLocale);
  const [dirty,setDirty] = useState(false);
  const [busy,setBusy] = useState(false);
  const [refreshing,startTransition] = useTransition();
  const [error,setError] = useState<string|null>(null);
  const inFlight = useRef(false);
  const router = useRouter();
  const row = data.translations.find(t=>t.locale===selected);
  const pending = busy || refreshing;
  const editable = data.canEdit && !data.published;
  const source = selected === data.sourceLocale;
  function choose(locale:string) {
    if (pending || locale===selected || !canLeaveTranslation(dirty,()=>window.confirm(labels.discard))) return;
    setSelected(locale); setDirty(false); setError(null);
  }
  async function mutate(operation:"ADD"|"EDIT"|"REMOVE",content?:TranslationContent) {
    if (inFlight.current || !editable) return;
    if (operation === "REMOVE" && (!window.confirm(labels.confirmRemove) || !canLeaveTranslation(dirty,()=>window.confirm(labels.discard)))) return;
    inFlight.current=true; setBusy(true); setError(null);
    const payload = {operation,locale:selected,...data.evidence,
      ...(operation==="ADD" ? {} : {translationId:row?.id,expectedTranslationUpdatedAt:row?.updatedAt}),
      ...(operation==="EDIT" ? {content} : {})};
    try {
      const response = await fetch(`/api/products/${data.productId}/translations`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result:unknown = await response.json();
      const status = typeof result==="object" && result!==null && "status" in result ? result.status : null;
      if (response.ok && ["ADDED","UPDATED","REMOVED","NO_CHANGE"].includes(String(status))) {
        setDirty(false); startTransition(()=>router.refresh());
      } else setError(status==="VALIDATION_ERROR" ? labels.validation : ["CONFLICT","STALE_WRITE","NOT_EDITABLE","SOURCE_PROTECTED"].includes(String(status)) ? labels.conflict : labels.failure);
    } catch { setError(labels.failure); }
    finally { inFlight.current=false; setBusy(false); }
  }
  return <div className="mt-6 space-y-4" aria-busy={pending}>
    <h4 className="text-base font-bold">{labels.title}</h4>
    <p className="text-sm text-slate-600">{data.published?labels.readOnly:labels.privateDraft}</p>
    <div role="group" aria-label={labels.title} className="flex flex-wrap gap-2">
      {PASSVERO_LOCALES.filter(locale=>!data.published || data.translations.some(t=>t.locale===locale)).map(locale=>{
        const translation=data.translations.find(t=>t.locale===locale);
        const state=locale===data.sourceLocale?labels.source:!translation?labels.missing:data.published?labels.published:translationReady(translation)?labels.ready:labels.incomplete;
        return <button key={locale} type="button" disabled={pending} aria-pressed={selected===locale} onClick={()=>choose(locale)} className={`${button} ${selected===locale?"border-teal-700 bg-teal-50 text-teal-900":"bg-white"}`}>{locale.toUpperCase()} · {labels.languages[locale]} · {state}</button>;
      })}
    </div>
    {error?<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" className="min-h-11 underline" onClick={()=>{if(canLeaveTranslation(dirty,()=>window.confirm(labels.discard))) window.location.reload();}}>{labels.reload}</button></div>:null}
    {!row?<div><p className="text-sm">{labels.empty}</p>{editable?<button type="button" disabled={pending} className={`${button} mt-3`} onClick={()=>void mutate("ADD")}>{labels.add}</button>:null}</div>:
      editable?<TranslationForm key={`${selected}:${row.id}:${row.updatedAt}`} row={row} source={source} dirty={dirty} labels={labels} pending={pending} baseEditHref={baseEditHref} onDirty={()=>setDirty(true)} onSave={content=>mutate("EDIT",content)} />:
      <dl lang={selected} className="space-y-3">{(["productName",...TRANSLATION_TEXT_FIELDS] as const).map(field=>row[field]?<div key={field}><dt className="text-sm font-semibold">{field==="productName"?labels.productName:labels.fields[field]}</dt><dd className="whitespace-pre-wrap break-words text-sm">{row[field]}</dd></div>:null)}</dl>}
    {row && editable && !source?<button type="button" disabled={pending} className={`${button} text-red-700`} onClick={()=>void mutate("REMOVE")}>{labels.remove}</button>:null}
    <p role="status" aria-live="polite" className="text-sm">{pending?labels.pending:""}</p>
  </div>;
}
export function TranslationForm({row,source,dirty,labels,pending,baseEditHref,onDirty,onSave}:Readonly<{
  row:TranslationManagerData["translations"][number]; source:boolean; dirty:boolean; labels:TranslationLabels; pending:boolean;
  baseEditHref:string; onDirty():void; onSave(content:TranslationContent):Promise<void>;
}>) {
  const id=useId();
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget); const content={...emptyTranslation(),productName:source?row.productName:String(form.get("productName")??"")};
    for(const key of TRANSLATION_TEXT_FIELDS) content[key]=String(form.get(key)??"");
    await onSave(content);
  }
  return <form onSubmit={submit} onChange={onDirty} className="space-y-4">
    <label className="block text-sm font-semibold" htmlFor={`${id}-name`}>{labels.productName}</label>
    <input id={`${id}-name`} name="productName" lang={row.locale} defaultValue={row.productName} readOnly={source} disabled={pending} className="min-h-11 w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-teal-600" />
    {source?<a href={baseEditHref} onClick={event=>{if(!canLeaveTranslation(dirty,()=>window.confirm(labels.discard))) event.preventDefault();}} className="inline-flex min-h-11 items-center text-sm text-teal-800 underline">{labels.sourceName}</a>:<p className="text-sm text-slate-600">{translationReady(row)?labels.ready:labels.incomplete}</p>}
    {TRANSLATION_TEXT_FIELDS.map(field=><div key={field}><label htmlFor={`${id}-${field}`} className="block text-sm font-semibold">{labels.fields[field]}</label><textarea id={`${id}-${field}`} name={field} lang={row.locale} defaultValue={row[field]??""} rows={3} disabled={pending} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-base focus:ring-2 focus:ring-teal-600" /></div>)}
    <button type="submit" disabled={pending} className={`${button} bg-teal-700 text-white`}>{labels.save}</button>
  </form>;
}
