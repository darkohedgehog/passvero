"use client";
import { useState,useTransition } from "react";
import { useLocale,useTranslations } from "next-intl";
import { billingCountryCodes,billingValuesSchema,type BillingProfile,type BillingValues } from "@/src/application/billing/contracts";
import { ProductActionIcon,editorInput,editorPrimaryAction,editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";
const empty:BillingValues={legalName:"",addressLine1:"",addressLine2:null,city:"",postalCode:null,countryCode:"",billingEmail:"",taxIdentifier:null,vatIdentifier:null};
const fields=["legalName","addressLine1","addressLine2","city","postalCode","billingEmail","taxIdentifier","vatIdentifier"] as const;
const autocomplete:Partial<Record<typeof fields[number],string>>={legalName:"organization",addressLine1:"address-line1",addressLine2:"address-line2",city:"address-level2",postalCode:"postal-code",billingEmail:"email"};
const required=new Set<string>(["legalName","addressLine1","city","billingEmail"]);
export function BillingProfileForm({profile}:{profile:BillingProfile|null}) {
  const t=useTranslations("BillingProfile"),locale=useLocale();
  const [values,setValues]=useState<BillingValues>(profile?.values??empty),[revision,setRevision]=useState(profile?.revision??0);
  const [message,setMessage]=useState<"success"|"noChange"|"invalid"|"failure"|"forbidden"|"conflict"|"reviewed"|null>(null),[pending,startTransition]=useTransition();
  const [conflict,setConflict]=useState(false),[latest,setLatest]=useState<BillingProfile|null>(null);
  const countries=new Intl.DisplayNames([locale === "sr" ? "sr-Latn" : locale],{type:"region"});
  async function inspectConflict(){
    startTransition(async()=>{try{const response=await fetch('/api/organization/billing-profile',{cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();if(!data.profile || !billingValuesSchema.safeParse(data.profile.values).success || !Number.isInteger(data.profile.revision))throw new Error();setLatest(data.profile);}catch{setMessage("failure");}});
  }
  return <form className="max-w-3xl space-y-6" onSubmit={e=>{e.preventDefault();const parsed=billingValuesSchema.safeParse(values);if(!parsed.success){setMessage("invalid");return;}startTransition(async()=>{try{
    const response=await fetch('/api/organization/billing-profile',{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:revision,values:parsed.data})});
    if(response.status===409){setConflict(true);setLatest(null);setMessage("conflict");return;}
    if(!response.ok){setMessage(response.status===400?"invalid":response.status===403?"forbidden":"failure");return;}
    const result=await response.json();if(!Number.isInteger(result.revision))throw new Error();setRevision(result.revision);setValues(parsed.data);setConflict(false);setLatest(null);setMessage(result.status==="NO_CHANGE"?"noChange":"success");
  }catch{setMessage("failure");}});}}>
    <p className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-slate-700">{t("description")}</p>
    {revision===0?<p className="text-sm text-slate-600">{t("empty")}</p>:null}
    <fieldset disabled={pending} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <legend className="px-2 text-lg font-semibold">{t("company")}</legend>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        {fields.map(field=><label key={field} className="min-w-0 text-sm font-medium text-slate-800">{t(field)} <span className="font-normal text-slate-600">({t(required.has(field)?"required":"optional")})</span>
          <input className={`${editorInput} mt-2 w-full min-w-0`} name={field} autoComplete={autocomplete[field]} required={required.has(field)} type={field==="billingEmail"?"email":"text"} maxLength={field==="billingEmail"?254:field==="city"?100:field==="postalCode"?32:field.endsWith("Identifier")?64:200} value={values[field]??""} onChange={e=>setValues(v=>({...v,[field]:e.target.value || (required.has(field)?"":null)}))}/>
        </label>)}
        <label className="min-w-0 text-sm font-medium text-slate-800">{t("countryCode")} <span className="font-normal text-slate-600">({t("required")})</span>
          <select name="countryCode" autoComplete="country" required className={`${editorInput} mt-2 w-full min-w-0`} value={values.countryCode} onChange={e=>setValues(v=>({...v,countryCode:e.target.value}))}>
            <option value="">{t("selectCountry")}</option>{billingCountryCodes.map(code=><option key={code} value={code}>{countries.of(code)} ({code})</option>)}
          </select>
        </label>
      </div>
      <p className="mt-5 text-sm text-slate-600">{t("formatOnly")}</p>
    </fieldset>
    {message?<p role={message==="success"||message==="noChange"?"status":"alert"} className="rounded-lg border border-slate-300 bg-white p-4 text-sm">{t(message)}</p>:null}
    {conflict?<section className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <button type="button" disabled={pending} className={editorSecondaryAction} onClick={inspectConflict}>{t("inspectLatest")}</button>
      {latest?<><dl className="grid gap-2 break-words text-sm">{([...fields,"countryCode"] as const).map(key=><div key={key}><dt className="font-semibold">{t(key)}</dt><dd>{latest.values[key]??"—"}</dd></div>)}</dl><button type="button" className={editorSecondaryAction} onClick={()=>{setRevision(latest.revision);setConflict(false);setLatest(null);setMessage("reviewed");}}>{t("useRevision")}</button></>:null}
    </section>:null}
    <button type="submit" disabled={pending||conflict} className={`${editorPrimaryAction} max-w-full whitespace-normal`}><ProductActionIcon name="save"/>{t(pending?"saving":"save")}</button>
  </form>;
}
