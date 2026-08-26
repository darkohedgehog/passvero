"use client";

import { FormEvent, useRef, useState } from "react";

import { selectDashboardOrganization } from "@/src/application/context/dashboard-ui-client";
import { useRouter } from "@/src/i18n/navigation";

export function OrganizationSelector({
  organizations,
  legend,
  continueLabel,
  pendingLabel,
  failureLabel,
}: Readonly<{
  organizations: readonly {
    readonly organizationId: string;
    readonly displayName: string;
  }[];
  legend: string;
  continueLabel: string;
  pendingLabel: string;
  failureLabel: string;
}>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    const targetOrganizationId = data.get("organization");
    if (typeof targetOrganizationId !== "string") {
      setFailed(true);
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    const result = await selectDashboardOrganization(
      window.fetch.bind(window),
      targetOrganizationId,
    );
    if (result === "SUCCESS") {
      router.refresh();
      return;
    }
    inFlight.current = false;
    setPending(false);
    setFailed(true);
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="space-y-6">
      <fieldset disabled={pending} className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800">
          {legend}
        </legend>
        {organizations.map((organization, index) => (
          <label
            key={organization.organizationId}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-teal-600 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50"
          >
            <input
              type="radio"
              name="organization"
              value={organization.organizationId}
              defaultChecked={index === 0}
              required
              className="size-4 accent-teal-700"
            />
            <span>{organization.displayName}</span>
          </label>
        ))}
      </fieldset>
      <p role={failed ? "alert" : undefined} aria-live="assertive" className="text-sm font-medium text-red-700">
        {failed ? failureLabel : ""}
      </p>
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="min-h-11 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? pendingLabel : continueLabel}
      </button>
    </form>
  );
}
