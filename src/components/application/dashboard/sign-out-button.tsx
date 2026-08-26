"use client";

import { useRef, useState } from "react";

import { signOutFromDashboard } from "@/src/application/context/dashboard-ui-client";
import { useRouter } from "@/src/i18n/navigation";

export function SignOutButton({
  label,
  pendingLabel,
  failureLabel,
}: Readonly<{
  label: string;
  pendingLabel: string;
  failureLabel: string;
}>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    const result = await signOutFromDashboard(window.fetch.bind(window));
    if (result === "SUCCESS") {
      router.replace("/login");
      router.refresh();
      return;
    }
    inFlight.current = false;
    setPending(false);
    setFailed(true);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        aria-disabled={pending}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? pendingLabel : label}
      </button>
      <p aria-live="polite" className="text-sm text-red-700">
        {failed ? failureLabel : ""}
      </p>
    </div>
  );
}
