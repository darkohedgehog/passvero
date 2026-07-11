type BrandLogoProps = {
  label: string;
  inverse?: boolean;
};

export function BrandLogo({ label, inverse = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={label}>
      <span
        aria-hidden="true"
        className={`grid size-9 place-items-center rounded-[9px] border-2 ${inverse ? "border-teal-400" : "border-teal-500"}`}
      >
        <svg viewBox="0 0 32 32" className="size-7" fill="none">
          <path
            d="M5 5h7v7H5V5Zm3 3h1v1H8V8Zm12-3h7v7h-7V5Zm3 3h1v1h-1V8ZM5 20h7v7H5v-7Zm3 3h1v1H8v-1Zm8-15h2v4h-2V8Zm0 7h4v2h-4v-2Zm-1 5h3v3h3v4h-2v-2h-3v-5Zm7-4h5v3h-2v-1h-3v-2Z"
            className={inverse ? "fill-white" : "fill-navy-950"}
          />
          <path
            d="m17 22 3 3 7-8"
            stroke="#14B8A6"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className={`text-[1.65rem] font-bold tracking-[-0.045em] ${inverse ? "text-white" : "text-navy-950"}`}
      >
        {label}
      </span>
    </span>
  );
}
