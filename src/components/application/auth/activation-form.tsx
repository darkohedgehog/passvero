"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  activateAccount,
  captureActivationCapability,
} from "@/src/application/auth/auth-ui-client";
import {
  AuthField,
  AuthStatusMessage,
  AuthSubmitButton,
} from "./auth-primitives";
import { TurnstileChallenge } from "./turnstile-challenge";

type ActivationState = "CHECKING" | "VALID" | "INVALID" | "ERROR" | "TURNSTILE_REQUIRED" | "TURNSTILE_FAILURE" | "SUCCESS";

export function ActivationForm() {
  const t = useTranslations("Auth");
  const [state, setState] = useState<ActivationState>("CHECKING");
  const [pending, setPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string>();
  const [challengeKey, setChallengeKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const turnstileTokenRef = useRef<string | undefined>(undefined);
  const capabilityRef = useRef<string | null>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    capabilityRef.current = captureActivationCapability(window.location, window.history);
    setState(capabilityRef.current === null ? "INVALID" : "VALID");
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
    const capability = capabilityRef.current;
    if (capability === null) {
      setState("INVALID");
      return;
    }
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) {
      setPasswordError(t("common.passwordMismatch"));
      requestAnimationFrame(() => document.getElementById("activation-confirm-password")?.focus());
      return;
    }
    setPasswordError(undefined);
    inFlightRef.current = true;
    setPending(true);
    const result = await activateAccount(window.fetch.bind(window), {
      capability,
      password,
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
    return <AuthStatusMessage tone="info">{t("activation.checking")}</AuthStatusMessage>;
  }
  if (state === "INVALID") {
    return <AuthStatusMessage tone="error">{t("activation.invalid")}</AuthStatusMessage>;
  }
  if (state === "SUCCESS") {
    return <AuthStatusMessage tone="success">{t("activation.success")}</AuthStatusMessage>;
  }

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={pending} className="space-y-5">
      {state === "ERROR" || state === "TURNSTILE_FAILURE" ? (
        <AuthStatusMessage tone="error" focusRef={errorRef}>
          {state === "TURNSTILE_FAILURE" ? t("common.turnstileFailure") : t("activation.failure")}
        </AuthStatusMessage>
      ) : null}
      <AuthField
        id="activation-password"
        name="password"
        type="password"
        label={t("common.newPassword")}
        hint={t("common.passwordGuidance")}
        autoComplete="new-password"
        required
        maxLength={256}
      />
      <AuthField
        id="activation-confirm-password"
        name="confirmPassword"
        type="password"
        label={t("common.confirmPassword")}
        autoComplete="new-password"
        error={passwordError}
        required
        maxLength={256}
      />
      {state === "TURNSTILE_REQUIRED" ? (
        <TurnstileChallenge key={challengeKey} action="auth_activate_account" label={t("common.turnstilePrompt")} onToken={onTurnstileToken} onFailure={onTurnstileFailure} />
      ) : null}
      <AuthSubmitButton pending={pending} label={t("activation.submit")} pendingLabel={t("common.pending")} />
    </form>
  );
}
