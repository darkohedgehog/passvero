"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useRef, useState } from "react";

import { requestPasswordReset } from "@/src/application/auth/auth-ui-client";
import { Link } from "@/src/i18n/navigation";
import { AuthField, AuthStatusMessage, AuthSubmitButton } from "./auth-primitives";
import { TurnstileChallenge } from "./turnstile-challenge";

type ForgotState = "IDLE" | "ERROR" | "TURNSTILE_REQUIRED" | "TURNSTILE_FAILURE" | "SUCCESS";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [state, setState] = useState<ForgotState>("IDLE");
  const [pending, setPending] = useState(false);
  const [challengeKey, setChallengeKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const turnstileTokenRef = useRef<string | undefined>(undefined);
  const focusError = () => requestAnimationFrame(() => errorRef.current?.focus());
  const onToken = useCallback((token: string) => {
    turnstileTokenRef.current = token;
    formRef.current?.requestSubmit();
  }, []);
  const onFailure = useCallback(() => {
    turnstileTokenRef.current = undefined;
    setState("TURNSTILE_FAILURE");
    focusError();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    const result = await requestPasswordReset(window.fetch.bind(window), {
      email: String(data.get("email") ?? ""),
      ...(turnstileTokenRef.current === undefined ? {} : { turnstileToken: turnstileTokenRef.current }),
    });
    turnstileTokenRef.current = undefined;
    inFlightRef.current = false;
    setPending(false);
    if (result === "SUCCESS") {
      setState("SUCCESS");
      return;
    }
    if (result === "TURNSTILE_REQUIRED") {
      setChallengeKey((value) => value + 1);
      setState("TURNSTILE_REQUIRED");
      return;
    }
    setState("ERROR");
    focusError();
  }

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={pending} className="space-y-5">
      {state === "SUCCESS" ? <AuthStatusMessage tone="success">{t("forgot.success")}</AuthStatusMessage> : null}
      {state === "ERROR" || state === "TURNSTILE_FAILURE" ? (
        <AuthStatusMessage tone="error" focusRef={errorRef}>
          {state === "TURNSTILE_FAILURE" ? t("common.turnstileFailure") : t("forgot.failure")}
        </AuthStatusMessage>
      ) : null}
      {state === "SUCCESS" ? null : (
        <>
          <AuthField id="forgot-email" name="email" type="email" label={t("common.email")} autoComplete="email" inputMode="email" required maxLength={254} />
          {state === "TURNSTILE_REQUIRED" ? (
            <TurnstileChallenge key={challengeKey} action="auth_password_reset_request" label={t("common.turnstilePrompt")} onToken={onToken} onFailure={onFailure} />
          ) : null}
          <AuthSubmitButton pending={pending} label={t("forgot.submit")} pendingLabel={t("common.pending")} />
        </>
      )}
      <div aria-live="polite" className="text-center text-sm">
        <Link href="/login" className="font-semibold text-teal-700 underline-offset-4 hover:underline">{t("common.backToLogin")}</Link>
      </div>
    </form>
  );
}
