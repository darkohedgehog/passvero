"use client";
/* eslint-disable @next/next/no-img-element -- Preserve authenticated private image delivery. */
import { useState } from "react";
import { MarketingIcon } from "@/src/components/marketing/marketing-icons";

/** Small list previews only; full product/DPP images keep their existing sizing. */
export function ProductThumbnail({ productId, imageId }: { productId: string; imageId: string | null }) {
  const src = imageId ? `/api/products/${productId}/images/${imageId}` : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-slate-500">
    {src && failedSrc !== src ? <img src={src} alt="" width={48} height={48} className="size-full object-cover object-center" onError={() => setFailedSrc(src)} /> : <MarketingIcon name="packaging" className="size-6" focusable="false" />}
  </span>;
}
