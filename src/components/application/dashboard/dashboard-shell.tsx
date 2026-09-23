import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/src/components/language-switcher";
import { SignOutButton } from "./sign-out-button";

export function DashboardShell({
  title,
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
  productsLabel: string;
  signOutLabel: string;
  pendingLabel: string;
  signOutFailureLabel: string;
  children: ReactNode;
}>) {
  return (
    <main id="dashboard-content" tabIndex={-1} className="min-w-0 px-4 py-5 outline-none sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
            {organizationName === undefined ? null : <p className="mt-1 break-words text-sm text-slate-600"><span className="sr-only">{organizationLabel}: </span>{organizationName}</p>}
          </div>
          <div className="flex max-w-full flex-wrap items-start gap-3">
            <LanguageSwitcher variant="dashboard" />
            <SignOutButton label={signOutLabel} pendingLabel={pendingLabel} failureLabel={signOutFailureLabel} />
          </div>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
