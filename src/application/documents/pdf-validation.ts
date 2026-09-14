import { z } from "zod";
import { MAX_DOCUMENT_PDF_SIZE } from "./pdf";

export const documentBytesIdentitySchema = z.object({
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_PDF_SIZE),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type DocumentBytesIdentity = z.infer<typeof documentBytesIdentitySchema>;

export const pdfValidationResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("VALID"), identity: documentBytesIdentitySchema }).strict(),
  z.object({ kind: z.literal("ENCRYPTED") }).strict(),
  z.object({ kind: z.literal("INVALID"), reason: z.enum(["STRUCTURE", "WARNING", "RECOVERY"]) }).strict(),
  z.object({ kind: z.literal("UNSUPPORTED") }).strict(),
  z.object({ kind: z.literal("INDETERMINATE") }).strict(),
  z.object({ kind: z.literal("TIMEOUT") }).strict(),
  z.object({ kind: z.literal("FAILED") }).strict(),
]);
export type PdfValidationResult = z.infer<typeof pdfValidationResultSchema>;

export interface PdfValidationPort {
  /**
   * Inspect an owned, immutable, nonempty PDF buffer bounded by MAX_DOCUMENT_PDF_SIZE.
   * The adapter must enforce the caller's cancellation/deadline, isolation and
   * resource limits, and bind VALID to these exact bytes. No repair or rewriting.
   * Signal delivery alone is not proof that a parser process has terminated.
   */
  validate(bytes: Uint8Array, options: { readonly signal: AbortSignal }): Promise<PdfValidationResult>;
}
