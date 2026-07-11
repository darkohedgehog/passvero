import type { SVGProps } from "react";

export type MarketingIconName =
  | "analytics"
  | "check"
  | "compliance"
  | "consumer"
  | "document"
  | "electronics"
  | "efficiency"
  | "furniture"
  | "interoperable"
  | "manufacturing"
  | "packaging"
  | "play"
  | "qr"
  | "risk"
  | "secure"
  | "share"
  | "textiles"
  | "trust"
  | "value"
  | "verify";

type MarketingIconProps = SVGProps<SVGSVGElement> & {
  name: MarketingIconName;
};

export function MarketingIcon({ name, ...props }: MarketingIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  const paths: Record<MarketingIconName, React.ReactNode> = {
    analytics: <><path d="M5 20V11h4v9H5Zm7 0V5h4v15h-4Zm7 0v-7h4v7h-4Z" /></>,
    check: <path d="m6 13 4 4 8-10" />,
    compliance: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    consumer: <><path d="M6 9h12l-1 11H7L6 9Z" /><path d="M9 9a3 3 0 0 1 6 0" /></>,
    document: <><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v5h5M10 12h5m-5 4h5" /></>,
    electronics: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M10 6h4m-3 12h2" /></>,
    efficiency: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2M12 2v2m0 16v2M2 12h2m16 0h2" /></>,
    furniture: <><path d="M6 12h12v7H6v-7Zm2-5h8a2 2 0 0 1 2 2v3H6V9a2 2 0 0 1 2-2Z" /><path d="M8 19v2m8-2v2" /></>,
    interoperable: <><path d="M10 14 8 16a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0" /><path d="m14 10 2-2a4 4 0 1 1 6 6l-3 3a4 4 0 0 1-6 0M8 12h8" /></>,
    manufacturing: <><path d="M3 21V10l6 3V9l6 4V5l6 4v12H3Z" /><path d="M7 17h2m4 0h2m4 0h2" /></>,
    packaging: <><path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="M4 8v9l8 4 8-4V8M12 12v9" /></>,
    play: <path d="m9 6 9 6-9 6V6Z" />,
    qr: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h3v3h3v3h-6v-6Z" /></>,
    risk: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /><path d="M12 8v5m0 3h.01" /></>,
    secure: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    share: <><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="m8 11 8-4m-8 6 8 4" /></>,
    textiles: <><path d="M4 8c4-5 12-5 16 0-4 3-4 5 0 8-4 5-12 5-16 0 4-3 4-5 0-8Z" /><path d="m8 7 8 10m0-10L8 17" /></>,
    trust: <><path d="M4 12 9 7l4 4-5 5-4-4Zm16 0-5-5-4 4 5 5 4-4Z" /><path d="m9 15 3 3 3-3" /></>,
    value: <><path d="M4 18 10 12l4 3 6-8" /><path d="M15 7h5v5" /></>,
    verify: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common} {...props}>
      {paths[name]}
    </svg>
  );
}
