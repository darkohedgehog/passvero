"use client";

import { useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "@/src/components/language-switcher";
import { BrandLogo } from "@/src/components/marketing/brand-logo";

type MobileNavigationProps = {
  brand: string;
  closeLabel: string;
  ctaLabel: string;
  ctaHref: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  menuLabel: string;
  signInLabel: string;
};

export function MobileNavigation({
  brand,
  closeLabel,
  ctaLabel,
  ctaHref,
  links,
  menuLabel,
  signInLabel,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? closeLabel : menuLabel}
        className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-navy-950"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span aria-hidden="true" className="relative block h-4 w-5">
          <span className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform ${isOpen ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition-opacity ${isOpen ? "opacity-0" : ""}`} />
          <span className={`absolute left-0 top-[14px] h-0.5 w-5 bg-current transition-transform ${isOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-navy-950/25 backdrop-blur-sm" role="presentation">
          <nav
            aria-label={menuLabel}
            className="ml-auto flex h-full w-[min(22rem,88vw)] flex-col bg-white p-6 shadow-2xl"
          >
            <div className="mb-8 flex items-center justify-between gap-4">
              <BrandLogo label={brand} />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={closeLabel}
                className="grid size-11 place-items-center rounded-lg border border-slate-200 text-2xl"
                onClick={() => setIsOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-3 text-lg font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-auto grid gap-4 border-t border-slate-200 pt-6">
              <LanguageSwitcher />
              <a className="text-center font-semibold text-blue-600" href="#demo" onClick={() => setIsOpen(false)}>{signInLabel}</a>
              <a className="flex min-h-12 items-center justify-center rounded-[10px] bg-teal-600 px-6 font-semibold text-white" href={ctaHref} onClick={() => setIsOpen(false)}>{ctaLabel}</a>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
