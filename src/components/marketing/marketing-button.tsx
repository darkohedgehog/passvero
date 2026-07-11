import type { ReactNode } from "react";

type MarketingButtonProps = {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "teal";
  className?: string;
};

const variantClasses = {
  primary:
    "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700",
  secondary:
    "border-slate-300 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50",
  teal: "border-teal-600 bg-teal-600 text-white hover:border-teal-700 hover:bg-teal-700",
} as const;

export function MarketingButton({
  children,
  href,
  variant = "primary",
  className = "",
}: MarketingButtonProps) {
  return (
    <a
      className={`inline-flex min-h-11 items-center justify-center rounded-[10px] border px-6 py-3 text-sm font-semibold transition-colors ${variantClasses[variant]} ${className}`.trim()}
      href={href}
    >
      {children}
    </a>
  );
}
