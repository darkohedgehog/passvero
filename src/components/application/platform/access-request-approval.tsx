"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
export function AccessRequestApproval({ requestId }: {
  requestId: string;
}) {
  const t = useTranslations("AccessRequests");
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function approve() {
    if (!confirmed || inFlight.current)
      return;
    inFlight.current = true;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/access-requests/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: requestId, confirm: "APPROVE_AND_SEND_ACTIVATION" }) });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("status" in result) || !["APPROVED", "ALREADY_APPROVED"].includes(String(result.status)))
        throw Error();
      setMessage("deliveryStatus" in result && result.deliveryStatus === "SENT" ? t("approvalSent") : t("approvalReconcile"));
    }
    catch {
      setMessage(t("approvalError"));
    }
    finally {
      inFlight.current = false;
      setPending(false);
      setConfirmed(false);
      router.refresh();
    }
  }
  return <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
 <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="mt-1 shrink-0"/>{t("approvalConfirmation")}</label>
 <button type="button" disabled={!confirmed || pending} onClick={() => void approve()} className="inline-flex min-h-11 max-w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{t(pending ? "approving" : "approve")}</button>
 {message ? <p role="status" className="text-sm text-slate-700">{message}</p> : null}
</div>;
}
