"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  captureEmailLinkToken,
  resetPassword,
} from "@/src/application/auth/auth-ui-client";
import { Link } from "@/src/i18n/navigation";
import {
  AuthField,
  AuthStatusMessage,
  AuthSubmitButton,
} from "./auth-primitives";
import { TurnstileChallenge } from "./turnstile-challenge";

type ResetState =
  | "CHECKING"
  | "VALID"
  | "INVALID"
  | "ERROR"
  | "TURNSTILE_REQUIRED"
  | "TURNSTILE_FAILURE"
  | "SUCCESS";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const [state, setState] = useState<ResetState>("CHECKING");
  const [pending, setPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string>();
  const [challengeKey, setChallengeKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const turnstileTokenRef = useRef<string | undefined>(undefined);
  const tokenRef = useRef<string | null>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    tokenRef.current = captureEmailLinkToken(window.location, window.history);
    setState(tokenRef.current === null ? "INVALID" : "VALID");
  }, []);

  const focusError = () => requestAnimationFrame(() => errorRef.current?.focus());
  const onTurnstileToken = useCallback((token: string) => {
    turnstileTokenRef.current = token;
    formRef.current?.requestSubmit();
  }, []);
  const onTurnstileFailure = useCallback(() => {
    turnstileTokenRef.current = undefined;
    setState("TURNSTILE_FAILURE");
    focusError();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current) return;
    const token = tokenRef.current;
    if (token === null) {
      setState("INVALID");
      return;
    }
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== String(data.get("confirmPassword") ?? "")) {
      setPasswordError(t("common.passwordMismatch"));
      requestAnimationFrame(() => document.getElementById("reset-confirm-password")?.focus());
      return;
    }
    setPasswordError(undefined);
    inFlightRef.current = true;
    setPending(true);
    const result = await resetPassword(window.fetch.bind(window), {
      token,
      newPassword,
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

  if (state === "CHECKING") {
    return <AuthStatusMessage tone="info">{t("reset.checking")}</AuthStatusMessage>;
  }
  if (state === "INVALID") {
    return <AuthStatusMessage tone="error">{t("reset.invalid")}</AuthStatusMessage>;
  }
  if (state === "SUCCESS") {
    return (
      <div className="space-y-5">
        <AuthStatusMessage tone="success">{t("reset.success")}</AuthStatusMessage>
        <Link href="/login" className="block text-center font-semibold text-teal-700 underline-offset-4 hover:underline">
          {t("verification.loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={pending} className="space-y-5">
      {state === "ERROR" || state === "TURNSTILE_FAILURE" ? (
        <AuthStatusMessage tone="error" focusRef={errorRef}>
          {state === "TURNSTILE_FAILURE" ? t("common.turnstileFailure") : t("reset.failure")}
        </AuthStatusMessage>
      ) : null}
      <AuthField id="reset-password" name="newPassword" type="password" label={t("common.newPassword")} hint={t("common.passwordGuidance")} autoComplete="new-password" required maxLength={256} />
      <AuthField id="reset-confirm-password" name="confirmPassword" type="password" label={t("common.confirmPassword")} autoComplete="new-password" error={passwordError} required maxLength={256} />
      {state === "TURNSTILE_REQUIRED" ? (
        <TurnstileChallenge key={challengeKey} action="auth_password_reset_consume" label={t("common.turnstilePrompt")} onToken={onTurnstileToken} onFailure={onTurnstileFailure} />
      ) : null}
      <AuthSubmitButton pending={pending} label={t("reset.submit")} pendingLabel={t("common.pending")} />
    </form>
  );
}
