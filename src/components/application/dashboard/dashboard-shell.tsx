import type { ReactNode } from "react";

import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { Link } from "@/src/i18n/navigation";
import { SignOutButton } from "./sign-out-button";

export function DashboardShell({
  brandLabel,
  title,
  signedInAsLabel,
  userLabel,
  organizationLabel,
  organizationName,
  signOutLabel,
  pendingLabel,
  signOutFailureLabel,
  children,
}: Readonly<{
  brandLabel: string;
  title: string;
  signedInAsLabel?: string;
  userLabel?: string;
  organizationLabel?: string;
  organizationName?: string;
  signOutLabel: string;
  pendingLabel: string;
  signOutFailureLabel: string;
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-teal-600">
              <BrandLogo label={brandLabel} />
            </Link>
            <h1 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-slate-950">
              {title}
            </h1>
          </div>
          <SignOutButton
            label={signOutLabel}
            pendingLabel={pendingLabel}
            failureLabel={signOutFailureLabel}
          />
        </header>
        {userLabel === undefined ? null : (
          <dl className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {signedInAsLabel}
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                {userLabel}
              </dd>
            </div>
            {organizationName === undefined ? null : (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {organizationLabel}
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                  {organizationName}
                </dd>
              </div>
            )}
          </dl>
        )}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
