"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { FormEvent, useCallback, useRef, useState } from "react";

import { signIn } from "@/src/application/auth/auth-ui-client";
import { Link } from "@/src/i18n/navigation";
import {
  AuthField,
  AuthStatusMessage,
  AuthSubmitButton,
} from "./auth-primitives";
import { TurnstileChallenge } from "./turnstile-challenge";

type LoginState = "IDLE" | "ERROR" | "TURNSTILE_REQUIRED" | "TURNSTILE_FAILURE" | "SUCCESS";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [state, setState] = useState<LoginState>("IDLE");
  const [pending, setPending] = useState(false);
  const [challengeKey, setChallengeKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const turnstileTokenRef = useRef<string | undefined>(undefined);

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
    inFlightRef.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    const result = await signIn(window.fetch.bind(window), {
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      ...(turnstileTokenRef.current === undefined
        ? {}
        : { turnstileToken: turnstileTokenRef.current }),
    });
    turnstileTokenRef.current = undefined;
    inFlightRef.current = false;
    setPending(false);

    if (result === "SUCCESS") {
      setState("SUCCESS");
      router.replace("/dashboard");
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
      {state === "ERROR" || state === "TURNSTILE_FAILURE" ? (
        <AuthStatusMessage tone="error" focusRef={errorRef}>
          {state === "TURNSTILE_FAILURE" ? t("common.turnstileFailure") : t("login.failure")}
        </AuthStatusMessage>
      ) : null}
      {state === "SUCCESS" ? (
        <AuthStatusMessage tone="success">{t("login.success")}</AuthStatusMessage>
      ) : null}
      <AuthField
        id="login-email"
        name="email"
        type="email"
        label={t("common.email")}
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
      />
      <AuthField
        id="login-password"
        name="password"
        type="password"
        label={t("common.password")}
        autoComplete="current-password"
        required
        maxLength={256}
      />
      {state === "TURNSTILE_REQUIRED" ? (
        <TurnstileChallenge
          key={challengeKey}
          action="auth_sign_in"
          label={t("common.turnstilePrompt")}
          onToken={onTurnstileToken}
          onFailure={onTurnstileFailure}
        />
      ) : null}
      <AuthSubmitButton
        pending={pending}
        label={t("login.submit")}
        pendingLabel={t("common.pending")}
      />
      <div aria-live="polite" className="text-center text-sm">
        <Link href="/forgot-password" className="font-semibold text-teal-700 underline-offset-4 hover:underline">
          {t("login.forgotPassword")}
        </Link>
      </div>
    </form>
  );
}
