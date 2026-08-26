"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: "light";
          callback(token: string): void;
          "error-callback"(): void;
          "expired-callback"(): void;
        },
      ): string;
      remove(widgetId: string): void;
    };
  }
}

export function TurnstileChallenge({
  action,
  label,
  onToken,
  onFailure,
}: Readonly<{
  action: string;
  label: string;
  onToken(token: string): void;
  onFailure(): void;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (widgetIdRef.current !== null) return;
    if (siteKey === undefined || siteKey.length === 0 || window.turnstile === undefined) {
      onFailure();
      return;
    }
    const container = containerRef.current;
    if (container === null) return;
    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      action,
      theme: "light",
      callback: onToken,
      "error-callback": onFailure,
      "expired-callback": onFailure,
    });
  }, [action, onFailure, onToken, siteKey]);

  useEffect(() => {
    if (window.turnstile !== undefined) renderWidget();
    return () => {
      if (widgetIdRef.current !== null && window.turnstile !== undefined) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 text-sm text-slate-700">{label}</p>
      <div ref={containerRef} className="min-h-[4.1rem]" />
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
        onError={onFailure}
      />
    </div>
  );
}
