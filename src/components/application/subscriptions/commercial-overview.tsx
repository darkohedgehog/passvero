"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CommercialState, OfferDto, PaidPeriodDto, RequestDto } from "@/src/application/subscriptions/contracts";
import { STANDARD_PLANS } from "@/src/application/subscriptions/catalog";
import { Link } from "@/src/i18n/navigation";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";
import { ReviewBadge, ReviewFact, ReviewHeading, ReviewIcon, ReviewSelect } from "@/src/components/application/platform/review-ui";
import { editorInput, editorPrimaryAction, editorSecondaryAction } from "@/src/components/application/products/product-editor-ui";

const panel = "min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const plans = [...STANDARD_PLANS.map(plan => ({ slug: plan.slug, name: plan.name })), { slug: "custom", name: "Custom" }];
function planName(slug: string) { return plans.find(plan => plan.slug === slug)?.name ?? slug; }
function useFormatting() {
  const locale = useLocale();
  return {
    money: (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100),
    date: (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" }).format(new Date(date)),
    storage: (bytes: number) => bytes >= 1024 ** 3 ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(bytes / 1024 ** 3)} GiB` : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(bytes / 1024 ** 2)} MiB`,
    number: (number: number) => new Intl.NumberFormat(locale).format(number),
  };
}
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <ReviewFact label={label}>{children}</ReviewFact>;
}
function useCommercialMutation() {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState<"success" | "failure" | "forbidden" | "invalid" | "conflict" | "expired" | "replaceAccepted" | "renewalNotice" | "billingRequired" | "reviewRequired" | "priceMismatch" | null>(null);
  const [blocked, setBlocked] = useState(false);
  async function execute(action: string, input: unknown) {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setPending(true);
    try {
      const response = await fetch(`/api/subscription/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) {
        let code: unknown;
        try { const result: unknown = await response.json(); if (result && typeof result === "object" && "status" in result) code = result.status; } catch { /* Unknown responses remain generic. */ }
        const specific = code === "COMMERCIAL_OFFER_EXPIRED" ? "expired" : code === "COMMERCIAL_OFFER_REQUIRES_REPLACEMENT" ? "replaceAccepted" : code === "COMMERCIAL_PLAN_CHANGE_UNSUPPORTED" ? "renewalNotice" : code === "COMMERCIAL_BILLING_PROFILE_REQUIRED" ? "billingRequired" : code === "COMMERCIAL_EXISTING_SUBSCRIPTION_REQUIRES_REVIEW" ? "reviewRequired" : code === "COMMERCIAL_PRICE_MISMATCH" ? "priceMismatch" : null;
        setMessage(specific ?? (response.status === 403 ? "forbidden" : response.status === 409 ? "conflict" : response.status === 400 ? "invalid" : "failure"));
        // Refresh before retrying an uncertain write or accepting a changed offer.
        setBlocked(response.status !== 400);
        return;
      }
      setMessage("success");
      setBlocked(true);
      window.location.reload();
    } catch { setMessage("failure"); setBlocked(true); }
    finally { inFlight.current = false; setPending(false); }
  }
  return { pending, blocked, message, execute };
}
function MutationMessage({ mutation }: { mutation: ReturnType<typeof useCommercialMutation> }) {
  const t = useTranslations("Subscription");
  if (!mutation.message) return null;
  return <div className="space-y-3" aria-live="polite"><p role={mutation.message === "success" ? "status" : "alert"} className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm">{t(mutation.message)}</p>{mutation.blocked ? <button type="button" className={editorSecondaryAction} onClick={() => window.location.reload()}>{t("refresh")}</button> : null}</div>;
}
export function OfferSummary({ offer, warnings }: { offer: OfferDto; warnings?:string[] }) {
  const t = useTranslations("Subscription"), billing = useTranslations("BillingProfile"), f = useFormatting();
  const snapshot = offer.snapshot;
  return <section className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <h4 className="flex min-w-0 items-start gap-2 font-bold text-slate-950 [overflow-wrap:anywhere]"><ReviewIcon name="document"/><span className="min-w-0 flex-1">{t("offer")}: {offer.reference.issuer} / {offer.reference.year} / {offer.reference.number}</span></h4>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Detail label={t("plan")}>{planName(snapshot.planSlug)}</Detail><Detail label={t("period")}>{snapshot.version===2&&snapshot.changeKind==="UPGRADE"?t("UPGRADE"):t("months", { count: snapshot.months })}</Detail>
      <Detail label={t("issued")}>{f.date(snapshot.offerIssuedAt)} (Europe/Zagreb)</Detail>
      <Detail label={t("expires")}>{f.date(offer.expiresAt)} (Europe/Zagreb)</Detail>
      <Detail label={t("net")}>{f.money(snapshot.netAmountCents)}</Detail><Detail label={t("total")}>{f.money(snapshot.totalAmountCents)}</Detail>
      <Detail label={t("tax")}>{snapshot.taxTreatment}</Detail><Detail label={t("terms")}>{snapshot.termsVersion}</Detail>
      <Detail label={t("publishedLimit")}>{f.number(snapshot.limits.maxPublishedProducts)}</Detail><Detail label={t("stored")}>{f.number(snapshot.limits.maxStoredProducts)}</Detail>
      <Detail label={t("storage")}>{f.storage(snapshot.limits.maxStorageBytes)}</Detail><Detail label={t("pdfLimit")}>{f.number(snapshot.limits.maxPdfAttachments)}</Detail>
      {snapshot.scheduledStart ? <Detail label={t("start")}>{f.date(snapshot.scheduledStart)}</Detail> : null}
      {snapshot.scheduledEnd ? <Detail label={t("end")}>{f.date(snapshot.scheduledEnd)}</Detail> : null}
    </dl>
    {snapshot.version===2&&snapshot.changeKind!=="STANDARD"?<div className="rounded-lg border border-amber-300 p-4 text-sm"><p>{t(snapshot.changeKind==="REPLACEMENT"?"replacementConsequence":snapshot.changeKind==="UPGRADE"?"upgradeConsequence":"downgradeConsequence")}</p>{(warnings??snapshot.downgradeWarnings).map(reason=><p key={reason}>{t(reason as "STORAGE_LIMIT")}</p>)}</div>:null}
    <p className="text-sm leading-6 text-slate-700">{t(snapshot.startPolicy === "ON_PAYMENT" ? "onPayment" : "contiguous")}</p>
    <p className="text-sm leading-6 text-slate-700">{t("retention")}</p><p className="text-sm leading-6 text-slate-700">{t("contentLock")}</p>
    <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer rounded-md font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">{t("snapshot")} · {snapshot.billingRevision}</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      {(Object.keys(snapshot.billingProfile) as Array<keyof typeof snapshot.billingProfile>).map(field => <Detail key={field} label={billing(field)}>{snapshot.billingProfile[field] ?? "—"}</Detail>)}
    </dl></details>
  </section>;
}
function Period({ period }: { period: PaidPeriodDto }) {
  const t = useTranslations("Subscription"), f = useFormatting();
  return <div className="space-y-3"><dl className="grid gap-4 sm:grid-cols-3"><Detail label={t("plan")}>{planName(period.planSlug)}</Detail><Detail label={t("start")}>{f.date(period.start)}</Detail><Detail label={t("end")}>{f.date(period.end)}</Detail></dl>{period.activationStatus==="BLOCKED_REQUIRES_OPERATOR"?<div role="status" className="rounded-lg border border-amber-300 p-4"><p>{t("blockedDowngrade")}</p>{period.activationReasons?.map(reason=><p key={reason}>{t(reason as "STORAGE_LIMIT")}</p>)}</div>:null}{period.paymentKind === "SIMULATED_PAYMENT" ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("SIMULATED_PAYMENT")}. {t("simulationNotice")}</p> : null}</div>;
}
function RequestForm({ state }: { state: CommercialState }) {
  const t = useTranslations("Subscription"), f = useFormatting(), mutation = useCommercialMutation();
  const open = state.requests.find(request => ["REQUESTED", "OFFERED", "ACCEPTED"].includes(request.status));
  const existingPlan = state.renewalPlanSlug;
  const [plan, setPlan] = useState(existingPlan ?? "start"), [months, setMonths] = useState<3 | 12>(3), [replace, setReplace] = useState(false);
  const [changeKind,setChangeKind]=useState<"STANDARD"|"UPGRADE"|"DOWNGRADE"|"REPLACEMENT">(state.unresolvedReplacementPeriodId?"REPLACEMENT":"STANDARD");
  const idempotencyKey = useRef<string | null>(null);
  const standard = STANDARD_PLANS.find(value => value.slug === plan);
  function change() { idempotencyKey.current = null; setReplace(false); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (open && !replace) return;
    idempotencyKey.current ??= crypto.randomUUID();
    void mutation.execute("request", { idempotencyKey: idempotencyKey.current, planSlug: plan, months, changeKind, ...(open ? { replaceRequestId: open.id } : {}) });
  }
  return <form onSubmit={submit} className={`${panel} space-y-5`} aria-busy={mutation.pending}>
    <ReviewHeading icon="receipt">{t(open ? "replace" : "request")}</ReviewHeading>
    <label className="block text-sm font-medium">{t("changeKind")}<ReviewSelect className={`${editorInput} mt-2`} value={changeKind} onChange={event=>{change();setChangeKind(event.target.value as typeof changeKind);}}><option value="STANDARD">{t("STANDARD")}</option>{state.currentPeriod?<><option value="UPGRADE">{t("UPGRADE")}</option><option value="DOWNGRADE">{t("DOWNGRADE")}</option></>:null}{state.unresolvedReplacementPeriodId?<option value="REPLACEMENT">{t("REPLACEMENT")}</option>:null}</ReviewSelect></label>
    <p className="text-sm text-slate-600">{t(changeKind==="REPLACEMENT"?"replacementConsequence":changeKind==="UPGRADE"?"upgradeConsequence":changeKind==="DOWNGRADE"?"downgradeConsequence":"renewalNotice")}</p>
    <fieldset disabled={mutation.pending || mutation.blocked} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("plan")}<ReviewSelect className={`${editorInput} mt-2 w-full`} value={plan} onChange={event => { change(); setPlan(event.target.value); }}>{plans.map(value => <option key={value.slug} value={value.slug}>{value.name}</option>)}</ReviewSelect></label>
      <label className="text-sm font-medium">{t("period")}<ReviewSelect className={`${editorInput} mt-2 w-full`} value={months} onChange={event => { change(); setMonths(Number(event.target.value) as 3 | 12); }}><option value={3}>{t("months", { count: 3 })}</option><option value={12}>{t("months", { count: 12 })}</option></ReviewSelect></label></div>
      <p className="rounded-lg bg-teal-50 p-4 text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">{changeKind==="UPGRADE"?t("supplementPrice"):standard ? f.money(months === 3 ? standard.quarterlyPriceCents : standard.yearlyPriceCents) : t("customPrice")}</p><p className="text-sm text-slate-600">{t("priceNotice")}</p>
      {standard ? <dl className="grid gap-4 sm:grid-cols-2"><Detail label={t("publishedLimit")}>{f.number(standard.limits.maxPublishedProducts)}</Detail><Detail label={t("stored")}>{f.number(standard.limits.maxStoredProducts)}</Detail><Detail label={t("storage")}>{f.storage(standard.limits.maxStorageBytes)}</Detail><Detail label={t("pdfLimit")}>{standard.limits.maxPdfAttachments}</Detail></dl> : null}
      {open ? <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} className="mt-1 size-4 shrink-0"/>{t("replaceConfirm")}</label> : null}
      <button type="submit" disabled={Boolean(open && !replace)} className={`${editorPrimaryAction} whitespace-normal`}><MarketingIcon name="receipt" className="size-5 shrink-0" aria-hidden="true"/>{t(mutation.pending ? "pending" : open ? "replace" : "request")}</button>
    </fieldset><MutationMessage mutation={mutation}/>
  </form>;
}
function AcceptForm({ request }: { request: RequestDto }) {
  const t = useTranslations("Subscription"), mutation = useCommercialMutation(), [confirmed, setConfirmed] = useState(false);
  return <form className="space-y-4 border-t border-slate-200 pt-5" aria-busy={mutation.pending} onSubmit={event => { event.preventDefault(); if (confirmed && request.offer) void mutation.execute("accept", { requestId: request.id, offerId: request.offer.id }); }}>
    <ReviewHeading icon="verify">{t("accept")}</ReviewHeading>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required disabled={mutation.pending || mutation.blocked} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0"/>{t("acceptConfirm")}</label>
    <p className="text-sm text-slate-600">{t("confirmationHint")}</p>
    <button type="submit" disabled={!confirmed || mutation.pending || mutation.blocked} className={editorPrimaryAction}><ReviewIcon name="verify"/>{t(mutation.pending ? "pending" : "accept")}</button><MutationMessage mutation={mutation}/>
  </form>;
}
export function CommercialOverview({ state, now, operator = false, allowSimulation = false }: { state: CommercialState; now: string; operator?: boolean; allowSimulation?: boolean }) {
  const t = useTranslations("Subscription"), f = useFormatting();
  return <div className="max-w-6xl space-y-6">
    <p className="text-sm leading-6 text-slate-700">{t("description")}</p>
    {state.entitlements?<section className={panel}><dl className="grid gap-4 sm:grid-cols-3"><Detail label={t("title")}>{t(state.entitlements.kind==="PAID"?"activePaid":state.entitlements.kind as "TRIAL")}</Detail><Detail label={t("plan")}>{state.entitlements.planSlug==="trial"?t("TRIAL"):state.entitlements.planSlug?planName(state.entitlements.planSlug):"—"}</Detail><Detail label={t("end")}>{state.entitlements.end?f.date(state.entitlements.end):"—"}</Detail>{state.usage?<><Detail label={t("storage")}>{f.storage(state.usage.storageBytes)} / {state.entitlements.limits?f.storage(state.entitlements.limits.maxStorageBytes):"—"}</Detail><Detail label={t("pdfLimit")}>{state.usage.maxPdfAttachmentsPerVersion} / {state.entitlements.limits?.maxPdfAttachments??"—"}</Detail></>:null}</dl>{state.entitlements.blockedReasons.map(reason=><p key={reason}>{t(reason as "STORAGE_LIMIT")}</p>)}</section>:null}
    <div className="grid gap-4 sm:grid-cols-2"><div className={panel}><dl><Detail label={t("occupied")}>{f.number(state.occupiedPublishedProducts)}{(state.entitlements?.limits??state.currentPeriod?.snapshot.limits) ? ` / ${f.number((state.entitlements?.limits??state.currentPeriod!.snapshot.limits).maxPublishedProducts)}` : ""}</Detail></dl></div><div className={panel}><dl><Detail label={t("stored")}>{f.number(state.storedProducts)}{(state.entitlements?.limits??state.currentPeriod?.snapshot.limits) ? ` / ${f.number((state.entitlements?.limits??state.currentPeriod!.snapshot.limits).maxStoredProducts)}` : ""}</Detail></dl></div></div>
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded-md font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">{t("help")}</summary><p className="mt-3 leading-6">{t("quotaNotice")}</p></details>
    <section className={`${panel} space-y-4`}><h2 className="text-lg font-semibold">{t("current")}</h2>{state.currentPeriod ? <Period period={state.currentPeriod}/> : <p className="text-sm text-slate-600">{t("noCurrent")}</p>}</section>
    {state.futurePeriods.length ? <section className={`${panel} space-y-5`}><h2 className="text-lg font-semibold">{t("future")}</h2>{state.futurePeriods.map(period => <Period key={period.id} period={period}/>)}</section> : null}
    {!operator && !state.canManage ? <p className="text-sm text-slate-600">{t("readOnly")}</p> : null}
    {!operator && state.canManage ? state.hasBillingProfile ? <RequestForm state={state}/> : <p className={panel}>{t("billingRequired")} <Link href="/dashboard/billing" className="font-semibold text-teal-700 underline">{t("billingLink")}</Link></p> : null}
    <section className="space-y-4"><h2 className="text-xl font-semibold">{t("requests")}</h2><p className="text-sm text-slate-600">{t("historyNotice")}</p>{!state.requests.length ? <p className={panel}>{t("empty")}</p> : state.requests.map(request => {
      const expired = request.offer !== null && new Date(request.offer.expiresAt).getTime() <= new Date(now).getTime();
      const open = ["REQUESTED", "OFFERED", "ACCEPTED"].includes(request.status);
      return <article key={request.id} className={`${panel} space-y-5`}><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">{planName(request.planSlug)} · {t("months", { count: request.months })}</h3><ReviewBadge status={request.status}>{t(request.status)}</ReviewBadge></div>
        {request.offer ? <OfferSummary offer={request.offer} warnings={request.currentWarnings}/> : null}
        {expired && open ? <p role="status" className="text-sm text-amber-900">{t("expired")} {request.status === "ACCEPTED" ? t("replaceAccepted") : null}</p> : null}
        {!operator && state.canManage && request.status === "OFFERED" && !expired && request.offer ? <AcceptForm key={request.offer.id} request={request}/> : null}
        {operator && state.canManage && (request.status === "REQUESTED" || request.status === "OFFERED") ? <OperatorOfferForm request={request}/> : null}
        {operator && state.canManage && request.status === "ACCEPTED" && request.offer && !expired ? <OperatorPaymentForm request={request} allowSimulation={allowSimulation}/> : null}
      </article>;
    })}</section>
  </div>;
}
function Field({ name, label, type = "text", defaultValue, max }: { name: string; label: string; type?: "text" | "number"; defaultValue?: string | number; max?: number }) {
  return <label className="min-w-0 text-sm font-medium">{label}<input name={name} required type={type} defaultValue={defaultValue} maxLength={type === "text" ? 200 : undefined} min={type === "number" ? 1 : undefined} max={max} step={1} className={`${editorInput} mt-2 w-full min-w-0`}/></label>;
}
function MoneyField({ name, label, cents }: { name: string; label: string; cents?: number }) {
  return <label className="min-w-0 text-sm font-medium">{label} (EUR)<input name={name} type="number" required min="0.01" max="9999999.99" step="0.01" defaultValue={cents === undefined ? undefined : (cents / 100).toFixed(2)} className={`${editorInput} mt-2 w-full min-w-0`}/></label>;
}
function cents(data: FormData, field: string) { return Math.round(Number(data.get(field)) * 100); }
function ReferenceFields() {
  const t = useTranslations("Subscription");
  return <div className="grid gap-4 sm:grid-cols-3"><Field name="issuer" label={t("issuer")}/><Field name="year" label={t("year")} type="number" max={9999}/><Field name="number" label={t("number")}/></div>;
}
function reference(data: FormData) { return { issuer: String(data.get("issuer")), year: Number(data.get("year")), number: String(data.get("number")) }; }
function OperatorOfferForm({ request }: { request: RequestDto }) {
  const t = useTranslations("Subscription"), mutation = useCommercialMutation();
  const standard = STANDARD_PLANS.find(plan => plan.slug === request.planSlug);
  const net = request.changeKind!=="UPGRADE"&&standard ? (request.months === 3 ? standard.quarterlyPriceCents : standard.yearlyPriceCents) : undefined;
  return <form className="space-y-4 border-t border-slate-200 pt-5" aria-busy={mutation.pending} onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void mutation.execute("offer", { requestId: request.id, issuedAtLocal: String(data.get("issuedAtLocal")), reference: reference(data), netAmountCents: cents(data, "netAmountCents"), totalAmountCents: cents(data, "totalAmountCents"), taxTreatment: String(data.get("taxTreatment")), termsVersion: String(data.get("termsVersion")), ...(request.planSlug === "custom" ? { customLimits: { maxPublishedProducts: Number(data.get("maxPublishedProducts")), maxStoredProducts: Number(data.get("maxStoredProducts")), maxStorageBytes: Number(data.get("maxStorageBytes")), maxPdfAttachments: Number(data.get("maxPdfAttachments")) } } : {}) });
  }}><ReviewHeading icon="document">{t("recordOffer")}</ReviewHeading><p className="text-sm leading-6 text-slate-600">{t("offerNotice")}</p><fieldset disabled={mutation.pending || mutation.blocked} className="space-y-4"><ReferenceFields/><label className="block min-w-0 text-sm font-medium">{t("issued")} (Europe/Zagreb)<input name="issuedAtLocal" type="datetime-local" required step={1} aria-describedby={`issued-hint-${request.id}`} className={`${editorInput} mt-2 w-full min-w-0`}/></label><p id={`issued-hint-${request.id}`} className="text-sm leading-6 text-slate-600">{t("issuedHint")}</p><div className="grid gap-4 sm:grid-cols-2"><MoneyField name="netAmountCents" label={t("net")} cents={net}/><MoneyField name="totalAmountCents" label={t("total")}/><Field name="taxTreatment" label={t("tax")}/><Field name="termsVersion" label={t("terms")}/></div>
    {request.planSlug === "custom" ? <div className="grid gap-4 sm:grid-cols-2"><Field name="maxPublishedProducts" label={t("publishedLimit")} type="number" max={2147483647}/><Field name="maxStoredProducts" label={t("stored")} type="number" max={2147483647}/><Field name="maxStorageBytes" label={t("storageBytes")} type="number" max={Number.MAX_SAFE_INTEGER}/><Field name="maxPdfAttachments" label={t("pdfLimit")} type="number" max={1000}/></div> : null}
    <button type="submit" className={editorPrimaryAction}><ReviewIcon name="document"/>{t(mutation.pending ? "pending" : "recordOffer")}</button></fieldset><MutationMessage mutation={mutation}/></form>;
}
function OperatorPaymentForm({ request, allowSimulation }: { request: RequestDto; allowSimulation: boolean }) {
  const t = useTranslations("Subscription"), mutation = useCommercialMutation(), [confirmed, setConfirmed] = useState(false), [kind, setKind] = useState("");
  return <form className="space-y-4 border-t border-slate-200 pt-5" aria-busy={mutation.pending} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (confirmed && kind && request.offer) void mutation.execute("payment", { requestId: request.id, offerId: request.offer.id, kind, reference: reference(data) }); }}>
    <ReviewHeading icon="receipt">{t("payment")}</ReviewHeading><p className="text-sm text-slate-600">{t("paymentReference")}</p>
    <fieldset disabled={mutation.pending || mutation.blocked} className="space-y-4"><ReferenceFields/>
      <label className="block text-sm font-medium">{t("paymentKind")}<ReviewSelect required value={kind} onChange={event => { setKind(event.target.value); setConfirmed(false); }} className={`${editorInput} mt-2 w-full`}><option value="" disabled>{t("choosePayment")}</option>{allowSimulation ? <option value="SIMULATED_PAYMENT">{t("SIMULATED_PAYMENT")}</option> : null}<option value="BANK_TRANSFER">{t("BANK_TRANSFER")}</option></ReviewSelect></label>
      {kind === "SIMULATED_PAYMENT" ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("simulationNotice")}</p> : null}
      <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0"/>{t("paymentConfirm")}</label>
      <p className="text-sm text-slate-600">{t("confirmationHint")}</p>
      <button type="submit" disabled={!confirmed || !kind} className={editorPrimaryAction}><ReviewIcon name="receipt"/>{t(mutation.pending ? "pending" : "payment")}</button>
    </fieldset><MutationMessage mutation={mutation}/>
  </form>;
}
