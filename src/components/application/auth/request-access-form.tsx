"use client";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { AuthField, AuthStatusMessage, AuthSubmitButton } from "./auth-primitives";
import { TurnstileChallenge } from "./turnstile-challenge";

export function RequestAccessForm() {
  const t = useTranslations("RequestAccess");
  const auth = useTranslations("Auth.common");
  const locale = useLocale();
  const [state, setState] = useState<"IDLE" | "SUCCESS" | "ERROR" | "CHALLENGE">("IDLE");
  const [pending, setPending] = useState(false);
  const [challengeKey, setChallengeKey] = useState(0);
  const inFlight = useRef(false);
  const token = useRef<string | undefined>(undefined);
  const form = useRef<HTMLFormElement>(null);
  const error = useRef<HTMLDivElement>(null);
  const onToken = useCallback((value: string) => { token.current = value; form.current?.requestSubmit(); }, []);
  const onFailure = useCallback(() => { token.current = undefined; setState("ERROR"); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || state === "SUCCESS") return;
    inFlight.current = true; setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/access-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactName: data.get("contactName"), email: data.get("email"), organizationDisplayName: data.get("organizationDisplayName"), locale: data.get("locale"), turnstileToken: token.current }) });
      const result: unknown = await response.json();
      if (response.status === 202) { setState("SUCCESS"); form.current?.reset(); }
      else if (typeof result === "object" && result !== null && "status" in result && result.status === "ADDITIONAL_VERIFICATION_REQUIRED") { setChallengeKey(value => value + 1); setState("CHALLENGE"); }
      else { setState("ERROR"); requestAnimationFrame(() => error.current?.focus()); }
    } catch { setState("ERROR"); requestAnimationFrame(() => error.current?.focus()); }
    finally { token.current = undefined; inFlight.current = false; setPending(false); }
  }
  if (state === "SUCCESS") return <AuthStatusMessage tone="success">{t("success")}</AuthStatusMessage>;
  return <form ref={form} onSubmit={submit} aria-busy={pending} className="space-y-5">
    {state === "ERROR" ? <AuthStatusMessage tone="error" focusRef={error}>{t("error")}</AuthStatusMessage> : null}
    <AuthField id="access-contact" name="contactName" label={t("contactName")} autoComplete="name" required maxLength={120} />
    <AuthField id="access-email" name="email" type="email" label={t("email")} autoComplete="email" required maxLength={254} />
    <AuthField id="access-organization" name="organizationDisplayName" label={t("organization")} autoComplete="organization" required maxLength={200} />
    <div><label htmlFor="access-locale" className="block text-sm font-semibold text-slate-800">{t("language")}</label>
      <select id="access-locale" name="locale" defaultValue={locale} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900">
        {Object.entries({ hr: "Hrvatski", en: "English", de: "Deutsch", sr: "Srpski", sl: "Slovenščina", pl: "Polski" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <p className="text-sm leading-6 text-slate-600">{t("notice")}</p>
    {state === "CHALLENGE" ? <TurnstileChallenge key={challengeKey} action="auth_request_access" label={auth("turnstilePrompt")} onToken={onToken} onFailure={onFailure} /> : null}
    <AuthSubmitButton pending={pending} label={t("submit")} pendingLabel={auth("pending")} />
  </form>;
}
