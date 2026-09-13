import { z } from "zod";
import type { AuthenticatedUserContext } from "../../context/authenticated-user-context";
import type { TranslationPersistence } from "../translation-management/contracts";

export const DOCUMENT_CATEGORIES = ["CERTIFICATE", "DECLARATION", "MANUAL", "OTHER"] as const;
export const DOCUMENT_LOCALES = ["hr", "en", "de", "sr", "sl", "pl"] as const;
const plain = (max: number, multiline = false) => z.string().max(max * 4).transform(v => v.normalize("NFC").trim()).refine(v => Array.from(v).length <= max && !(multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/ : /[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/).test(v));
export const attachmentMetadataSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES), locale: z.enum(DOCUMENT_LOCALES).nullable(),
  displayLabel: plain(200).refine(v => v.length > 0),
  description: plain(2000, true).nullable().transform(v => v || null),
  isPublic: z.boolean(),
}).strict();
export const sortOrderSchema = z.number().int().min(0).max(2147483647);
const timestamp = z.string().datetime({ precision: 3 }).refine(v => Number.isFinite(new Date(v).getTime()) && new Date(v).toISOString() === v);
const evidence = { expectedDraftVersionId: z.uuid(), expectedProductUpdatedAt: timestamp, expectedDraftUpdatedAt: timestamp };
const target = { attachmentId: z.uuid(), expectedAttachmentUpdatedAt: timestamp };
export const attachmentCommandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("ATTACH"), ...evidence, documentId: z.uuid(), metadata: attachmentMetadataSchema }).strict(),
  z.object({ operation: z.literal("EDIT"), ...evidence, ...target, metadata: attachmentMetadataSchema, sortOrder: sortOrderSchema }).strict(),
  z.object({ operation: z.literal("REMOVE"), ...evidence, ...target }).strict(),
]);
export type AttachmentCommand = z.infer<typeof attachmentCommandSchema>;
export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>;
export interface AttachmentRow {
  readonly id: string; readonly productVersionId: string; readonly documentId: string;
  readonly category: string; readonly locale: string | null; readonly displayLabel: string | null;
  readonly description: string | null; readonly isPublic: boolean; readonly isPrimary: boolean;
  readonly sortOrder: number; readonly updatedAt: Date;
  readonly document: { readonly organizationId: string; readonly status: string };
}
export interface AttachmentDto {
  readonly id: string; readonly documentId: string; readonly category: string; readonly locale: string | null;
  readonly displayLabel: string | null; readonly description: string | null; readonly isPublic: boolean;
  readonly sortOrder: number; readonly updatedAt: string; readonly availability: string;
  readonly downloadUrl: string | null;
}
export interface AttachmentState {
  readonly id: string; readonly organizationId: string; readonly lifecycleStatus: string;
  readonly currentDraftVersionId: string | null; readonly updatedAt: Date;
  readonly draft: null | { readonly id: string; readonly productId: string; readonly organizationId: string;
    readonly status: string; readonly updatedAt: Date; readonly attachments: readonly AttachmentRow[] };
}
export interface AttachmentPersistence<Tx> {
  readEligibility: TranslationPersistence<Tx>["readEligibility"];
  touch: TranslationPersistence<Tx>["touch"];
  lockState(tx: Tx, productId: string, organizationId: string): Promise<AttachmentState | null>;
  readDocument(tx: Tx, documentId: string, organizationId: string): Promise<{ status: string } | null>;
  attach(tx: Tx, draftId: string, documentId: string, metadata: AttachmentMetadata, sortOrder: number): Promise<void>;
  edit(tx: Tx, draftId: string, row: AttachmentRow, metadata: AttachmentMetadata, sortOrder: number): Promise<boolean>;
  remove(tx: Tx, draftId: string, row: AttachmentRow): Promise<boolean>;
  audit(tx: Tx, context: AuthenticatedUserContext, productId: string, operation: AttachmentCommand["operation"]): Promise<void>;
}
export interface AttachmentDependencies<Tx> {
  readonly persistence: AttachmentPersistence<Tx>;
  readonly transactionRunner: { run<R>(work: (tx: Tx) => Promise<R>): Promise<R> };
}
export type AttachmentResult = { status: "ATTACHED" | "UPDATED" | "REMOVED" | "NO_CHANGE" };
export type MutateAttachment = (productId: string, command: unknown, context: AuthenticatedUserContext | null) => Promise<AttachmentResult>;

export function attachmentDto(row: AttachmentRow, versionId: string, organizationId: string): AttachmentDto {
  if (row.productVersionId !== versionId || row.document.organizationId !== organizationId) throw new Error("Attachment ownership invariant.");
  return { id: row.id, documentId: row.documentId, category: row.category, locale: row.locale,
    displayLabel: row.displayLabel?.normalize("NFC").trim() || null, description: row.description,
    isPublic: row.isPublic, sortOrder: row.sortOrder, updatedAt: row.updatedAt.toISOString(),
    availability: row.document.status,
    downloadUrl: row.document.status === "AVAILABLE" ? `/api/documents/${encodeURIComponent(row.documentId)}` : null };
}
