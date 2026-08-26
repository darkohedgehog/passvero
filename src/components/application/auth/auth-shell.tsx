import type { ReactNode } from "react";

import { BrandLogo } from "@/src/components/marketing/brand-logo";
import { Link } from "@/src/i18n/navigation";

export function AuthShell({
  brandLabel,
  title,
  description,
  children,
  footer,
}: Readonly<{
  brandLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}>) {
  return (
    <main className="auth-shell min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-11 items-center rounded-md px-2"
        >
          <BrandLogo label={brandLabel} />
        </Link>
        <section
          aria-labelledby="auth-page-title"
          className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-[0_18px_50px_rgb(15_23_42_/_0.10)] sm:px-8 sm:py-9"
        >
          <div className="mb-7">
            <h1
              id="auth-page-title"
              className="text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl"
            >
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              {description}
            </p>
          </div>
          {children}
          {footer === undefined ? null : (
            <div className="mt-7 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
              {footer}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
