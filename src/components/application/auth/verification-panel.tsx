"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  captureEmailLinkToken,
  consumeEmailVerification,
  requestEmailVerification,
} from "@/src/application/auth/auth-ui-client";
import { Link } from "@/src/i18n/navigation";
import { AuthField, AuthStatusMessage, AuthSubmitButton } from "./auth-primitives";
import { TurnstileChallenge } from "./turnstile-challenge";

type VerificationState = "VERIFYING" | "SUCCESS" | "INVALID" | "ERROR" | "TURNSTILE_REQUIRED" | "TURNSTILE_FAILURE";

export function VerificationPanel() {
  const t = useTranslations("Auth");
  const [state, setState] = useState<VerificationState>("VERIFYING");
  const [challengeKey, setChallengeKey] = useState(0);
  const startedRef = useRef(false);
  const inFlightRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);

  const verify = useCallback(async (turnstileToken?: string) => {
    if (inFlightRef.current) return;
    const token = tokenRef.current;
    if (token === null) {
      setState("INVALID");
      return;
    }
    inFlightRef.current = true;
    setState("VERIFYING");
    const result = await consumeEmailVerification(window.fetch.bind(window), token, turnstileToken);
    inFlightRef.current = false;
    if (result === "SUCCESS") {
      setState("SUCCESS");
    } else if (result === "INVALID_OR_EXPIRED") {
      setState("INVALID");
    } else if (result === "TURNSTILE_REQUIRED") {
      setChallengeKey((value) => value + 1);
      setState("TURNSTILE_REQUIRED");
    } else {
      setState("ERROR");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    tokenRef.current = captureEmailLinkToken(window.location, window.history);
    void verify();
  }, [verify]);

  const onTurnstileToken = useCallback((token: string) => {
    void verify(token);
  }, [verify]);
  const onTurnstileFailure = useCallback(() => {
    setState("TURNSTILE_FAILURE");
    requestAnimationFrame(() => errorRef.current?.focus());
  }, []);

  if (state === "VERIFYING") {
    return <AuthStatusMessage tone="info">{t("verification.verifying")}</AuthStatusMessage>;
  }
  if (state === "SUCCESS") {
    return (
      <div className="space-y-5">
        <AuthStatusMessage tone="success">{t("verification.success")}</AuthStatusMessage>
        <Link href="/login" className="block text-center font-semibold text-teal-700 underline-offset-4 hover:underline">{t("verification.loginLink")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthStatusMessage tone="error" focusRef={errorRef}>
        {state === "INVALID" ? t("verification.invalid") : state === "TURNSTILE_FAILURE" ? t("common.turnstileFailure") : state === "ERROR" ? t("verification.failure") : t("common.turnstilePrompt")}
      </AuthStatusMessage>
      {state === "TURNSTILE_REQUIRED" ? (
        <TurnstileChallenge key={challengeKey} action="auth_email_verification_consume" label={t("common.turnstilePrompt")} onToken={onTurnstileToken} onFailure={onTurnstileFailure} />
      ) : null}
      {state === "INVALID" || state === "ERROR" ? <VerificationResendForm /> : null}
    </div>
  );
}

function VerificationResendForm() {
  const t = useTranslations("Auth");
  const [result, setResult] = useState<"IDLE" | "SUCCESS" | "ERROR" | "TURNSTILE_REQUIRED" | "TURNSTILE_FAILURE">("IDLE");
  const [pending, setPending] = useState(false);
  const [challengeKey, setChallengeKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const inFlightRef = useRef(false);
  const turnstileTokenRef = useRef<string | undefined>(undefined);

  const onTurnstileToken = useCallback((token: string) => {
    turnstileTokenRef.current = token;
    formRef.current?.requestSubmit();
  }, []);
  const onTurnstileFailure = useCallback(() => {
    turnstileTokenRef.current = undefined;
    setResult("TURNSTILE_FAILURE");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    const response = await requestEmailVerification(window.fetch.bind(window), {
      email: String(data.get("email") ?? ""),
      ...(turnstileTokenRef.current === undefined ? {} : { turnstileToken: turnstileTokenRef.current }),
    });
    turnstileTokenRef.current = undefined;
    inFlightRef.current = false;
    setPending(false);
    if (response === "SUCCESS") setResult("SUCCESS");
    else if (response === "TURNSTILE_REQUIRED") {
      setChallengeKey((value) => value + 1);
      setResult("TURNSTILE_REQUIRED");
    } else setResult("ERROR");
  }

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={pending} className="space-y-4 border-t border-slate-200 pt-6">
      <h2 className="font-semibold text-slate-950">{t("verification.resendTitle")}</h2>
      <p className="text-sm leading-6 text-slate-600">{t("verification.resendDescription")}</p>
      {result === "SUCCESS" ? <AuthStatusMessage tone="success">{t("verification.resendSuccess")}</AuthStatusMessage> : null}
      {result === "ERROR" || result === "TURNSTILE_FAILURE" ? <AuthStatusMessage tone="error">{result === "TURNSTILE_FAILURE" ? t("common.turnstileFailure") : t("common.genericFailure")}</AuthStatusMessage> : null}
      <AuthField id="verification-email" name="email" type="email" label={t("common.email")} autoComplete="email" inputMode="email" required maxLength={254} />
      {result === "TURNSTILE_REQUIRED" ? <TurnstileChallenge key={challengeKey} action="auth_email_verification_request" label={t("common.turnstilePrompt")} onToken={onTurnstileToken} onFailure={onTurnstileFailure} /> : null}
      <AuthSubmitButton pending={pending} label={t("verification.resendSubmit")} pendingLabel={t("common.pending")} />
    </form>
  );
}
