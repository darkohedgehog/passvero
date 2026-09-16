"use client";

import { useRef, useState } from "react";
import { DocumentScanControls } from "./document-scan-controls";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { attachmentMetadataSchema, DOCUMENT_CATEGORIES, DOCUMENT_LOCALES, type AttachmentDto, type AttachmentCommand } from "@/src/application/products/document-attachments/contracts";
import { AttachmentClientFailure, createUploadAttachmentFlow, sendAttachment, type AttachmentEvidence } from "@/src/application/products/document-attachments/ui-client";

const control = "mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white p-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-600";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50";

export function ProductDocumentsSection({ productId, documents, evidence, canEdit, published }: Readonly<{
  productId: string; documents: readonly AttachmentDto[]; evidence: AttachmentEvidence | null; canEdit: boolean; published: boolean;
}>) {
  const t = useTranslations("ProductDocuments");
  const router = useRouter();
  const [editor, setEditor] = useState<AttachmentDto | "NEW" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AttachmentClientFailure["code"] | null>(null);
  const busy = useRef(false);
  const editable = canEdit && !published && evidence !== null;
  async function remove(row: AttachmentDto) {
    if (!editable || !evidence || busy.current || !window.confirm(t("confirmRemove"))) return;
    busy.current = true; setPending(true); setError(null);
    try {
      await sendAttachment(productId, { ...evidence, operation: "REMOVE", attachmentId: row.id, expectedAttachmentUpdatedAt: row.updatedAt });
      router.refresh();
    } catch (failure) { setError(failure instanceof AttachmentClientFailure ? failure.code : "ATTACH_FAILED"); }
    finally { busy.current = false; setPending(false); }
  }
  return <section className="mt-6 min-w-0 border-t border-slate-200 pt-5">
    <h4 className="text-lg font-bold">{t(published ? "publishedTitle" : "draftTitle")}</h4>
    <p className="mt-2 text-sm text-slate-600">{t("privateNotice")}</p>
    {error ? <p role="alert" className="mt-3 text-red-800">{t(`errors.${error}`)}</p> : null}
    {documents.length === 0 ? <p className="mt-3 text-sm">{t("empty")}</p> : <ul className="mt-4 space-y-3">
      {documents.map(row => <li key={row.id} className="min-w-0 rounded-lg border border-slate-200 p-3">
        <p className="break-words font-semibold">{row.displayLabel || t("untitled")}</p>
        <p className="mt-1 text-sm">{DOCUMENT_CATEGORIES.includes(row.category as typeof DOCUMENT_CATEGORIES[number]) ? t(`categories.${row.category as typeof DOCUMENT_CATEGORIES[number]}`) : t("categories.OTHER")} · {row.locale?.toUpperCase() ?? t("neutral")} · PDF</p>
        {row.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.description}</p> : null}
        <p className="mt-2 text-sm">{t(row.isPublic ? "publicIntended" : "privateIntended")}</p>
        <DocumentScanControls documentId={row.documentId} canEdit={canEdit} />
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Binary delivery is controlled by the scan-aware server endpoint. */}
          {editable ? <><button type="button" className={button} disabled={pending || editor !== null} onClick={() => { setError(null); setEditor(row); }}>{t("edit")}</button>
            <button type="button" className={button} disabled={pending || editor !== null} onClick={() => void remove(row)}>{t("remove")}</button></> : null}
        </div>
      </li>)}
    </ul>}
    {editable && editor === null ? <button type="button" className={`${button} mt-4`} disabled={pending} onClick={() => setEditor("NEW")}>{t("add")}</button> : null}
    {editable && editor !== null && evidence ? <AttachmentForm productId={productId} evidence={evidence} row={editor === "NEW" ? null : editor} onClose={() => setEditor(null)} onSuccess={() => { setEditor(null); router.refresh(); }} /> : null}
  </section>;
}

export function AttachmentForm({ productId, evidence, row, onClose, onSuccess }: Readonly<{
  productId: string; evidence: AttachmentEvidence; row: AttachmentDto | null; onClose(): void; onSuccess(): void;
}>) {
  const t = useTranslations("ProductDocuments");
  const flow = useRef<ReturnType<typeof createUploadAttachmentFlow> | null>(null);
  if (flow.current === null) flow.current = createUploadAttachmentFlow(productId, evidence);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AttachmentClientFailure["code"] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const busy = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const parsed = attachmentMetadataSchema.safeParse({ category: form.get("category"), locale: form.get("locale") || null,
      displayLabel: form.get("displayLabel"), description: form.get("description") || null, isPublic: form.get("isPublic") === "on" });
    if (!parsed.success) { setError("VALIDATION_ERROR"); return; }
    busy.current = true; setPending(true); setError(null);
    try {
      if (row) {
        const command: AttachmentCommand = { ...evidence, operation: "EDIT", attachmentId: row.id, expectedAttachmentUpdatedAt: row.updatedAt, metadata: parsed.data, sortOrder: Number(form.get("sortOrder")) };
        await sendAttachment(productId, command);
      } else {
        const file = form.get("file");
        await flow.current!.submit(file instanceof File ? file : null, parsed.data, evidence);
      }
      onSuccess();
    } catch (failure) {
      setUploaded(flow.current!.uploaded);
      setUploadFailed(flow.current!.uploadAttempted && !flow.current!.uploaded);
      setError(failure instanceof AttachmentClientFailure ? failure.code : "ATTACH_FAILED");
    } finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={submit} onChange={() => setDirty(true)} className="mt-5 min-w-0 rounded-lg bg-slate-50 p-4">
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <legend className="font-semibold">{t(row ? "edit" : "add")}</legend>
      {!row ? <label className="block text-sm">{t("file")}<input type="file" name="file" accept="application/pdf,.pdf" required={!uploaded} disabled={uploaded || uploadFailed} className={control} /><span>{t("fileHint")}</span></label> : null}
      <label className="block text-sm">{t("category")}<select name="category" defaultValue={row?.category ?? "OTHER"} className={control}>{DOCUMENT_CATEGORIES.map(category => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}</select></label>
      <label className="block text-sm">{t("label")}<input name="displayLabel" defaultValue={row?.displayLabel ?? ""} required className={control} /></label>
      <label className="block text-sm">{t("language")}<select name="locale" defaultValue={row?.locale ?? ""} className={control}><option value="">{t("neutral")}</option>{DOCUMENT_LOCALES.map(locale => <option key={locale} value={locale}>{t(`languages.${locale}`)}</option>)}</select></label>
      <label className="block text-sm">{t("description")}<textarea name="description" defaultValue={row?.description ?? ""} rows={3} className={control} /></label>
      {row ? <label className="block text-sm">{t("order")}<input name="sortOrder" type="number" min={0} max={2147483647} step={1} required defaultValue={row.sortOrder} className={control} /></label> : null}
      <label className="flex items-start gap-2 text-sm"><input name="isPublic" type="checkbox" defaultChecked={row?.isPublic ?? false} className="mt-1" />{t("publicCheckbox")}</label>
      <p className="text-sm text-slate-600">{t("privateNotice")}</p>
      {uploaded ? <p role="status">{t("retained")}</p> : null}
      {error ? <p role="alert" className="text-red-800">{t(`errors.${error}`)}</p> : null}
      <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={uploadFailed}>{t(pending ? "pending" : uploaded ? "retry" : "save")}</button>
        <button type="button" className={button} onClick={() => { if ((!dirty && !uploaded) || window.confirm(t("confirmDiscard"))) onClose(); }}>{t("cancel")}</button></div>
    </fieldset>
  </form>;
}
