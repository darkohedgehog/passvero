"use client";

import { ProductActionIcon, editorPrimaryAction, editorDangerAction, editorInput } from "./product-editor-ui";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ImageState } from "@/src/application/products/images/contracts";
import { MAX_IMAGE_BYTES } from "@/src/application/products/images/contracts";
/* eslint-disable @next/next/no-img-element -- Private images must bypass optimizer caching. */
export function ProductImageEditor({ state, canEdit, published = false }: { state: ImageState; canEdit: boolean; published?: boolean }) {
  const t = useTranslations("ProductImage"), router = useRouter();
  const image = published ? state.published : state.draft?.image;
  const [altText, setAltText] = useState(image?.altText ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (published && !image) return null;
  function submit(remove: boolean) {
    const draft = state.draft; if (!draft) return;
    if (!remove && (!file || !["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_IMAGE_BYTES || !file.size)) { setMessage(t("invalid")); return; }
    startTransition(async () => {
      try {
        const command = { operation: remove ? "REMOVE" : "SET", expectedDraftVersionId: draft.id, expectedDraftUpdatedAt: draft.updatedAt, expectedProductUpdatedAt: state.updatedAt, ...(remove ? {} : { altText }) };
        const response = await fetch(`/api/products/${state.productId}/image`, { method: remove ? "DELETE" : "POST", headers: { "x-image-command": encodeURIComponent(JSON.stringify(command)), ...(!remove && file ? { "content-type": file.type } : {}) }, body: remove ? null : file });
        if (!response.ok) { setMessage(t(response.status === 400 ? "invalid" : response.status === 409 ? "stale" : "failure")); return; }
        setMessage(t("success")); router.refresh();
      } catch { setMessage(t("failure")); }
    });
  }
  return <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
    <h3 className="font-semibold">{t("title")} {published ? `— ${t("published")}` : ""}</h3>
    {image ? <img src={`/api/products/${state.productId}/images/${image.id}`} alt={image.altText ?? ""} width={image.width} height={image.height} className="block h-auto max-h-96 max-w-full object-contain" /> : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">{t("empty")}</p>}
    {!published ? <p className="text-sm text-slate-600">{t("help")}</p> : null}
    {!published && state.draft?.ambiguous ? <p role="alert">{t("ambiguous")}</p> : null}
    {!published && canEdit && !state.draft?.ambiguous ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); submit(false); }}>
      <label className="block text-sm">{t("file")}<input className="mt-1 block w-full min-w-0 text-sm" type="file" accept="image/jpeg,image/png" disabled={pending} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      <label className="block text-sm">{t("alt")}<input className={editorInput} value={altText} maxLength={300} disabled={pending} onChange={event => setAltText(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><button className={editorPrimaryAction} disabled={pending} type="submit"><ProductActionIcon name="upload" />{pending ? t("pending") : t("save")}</button>
        {image ? <button className={editorDangerAction} disabled={pending} type="button" onClick={() => submit(true)}><ProductActionIcon name="remove" />{t("remove")}</button> : null}</div>
    </form> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
