import { z } from "zod";
import { documentBytesIdentitySchema, pdfValidationResultSchema, type DocumentBytesIdentity } from "./pdf-validation";

// Initial, unreleased combined PDF-validation + malware policy, not an upgrade of stored verdicts.
export const DOCUMENT_SECURITY_POLICY_VERSION = 1;

export const documentMalwareFailureCodeSchema = z.enum([
  "SCANNER_UNAVAILABLE", "TIMEOUT", "INVALID_RESPONSE", "SCANNER_INTERRUPTED",
  "SCANNER_NOT_READY", "SIGNATURES_UNTRUSTED", "SCAN_INCOMPLETE",
  "INTEGRITY_MISMATCH", "INTERRUPTED", "PDF_ENCRYPTED", "PDF_INVALID",
  "PDF_UNSUPPORTED", "PDF_VALIDATION_FAILED",
]);
export type DocumentMalwareFailureCode = z.infer<typeof documentMalwareFailureCodeSchema>;

export const normalizedMalwareEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("OK"), complete: z.literal(true), identity: documentBytesIdentitySchema }).strict(),
  z.object({ kind: z.literal("MALWARE_DETECTED"), complete: z.literal(true), identity: documentBytesIdentitySchema }).strict(),
  z.object({ kind: z.literal("INCOMPLETE") }).strict(),
  z.object({ kind: z.literal("UNAVAILABLE") }).strict(),
  z.object({ kind: z.literal("TIMEOUT") }).strict(),
  z.object({ kind: z.literal("INTERRUPTED") }).strict(),
  z.object({ kind: z.literal("NOT_READY") }).strict(),
  z.object({ kind: z.literal("INVALID_RESPONSE") }).strict(),
]);
export type NormalizedMalwareEvidence = z.infer<typeof normalizedMalwareEvidenceSchema>;

const envelopeSchema = z.object({
  policyVersion: z.literal(DOCUMENT_SECURITY_POLICY_VERSION),
  integrity: z.unknown().optional(),
  pdf: z.unknown().optional(),
  scanner: z.unknown().optional(),
  signatureHealth: z.unknown().optional(),
}).strict();
const integritySchema = z.object({
  expected: documentBytesIdentitySchema,
  observed: documentBytesIdentitySchema,
}).strict();

export type DocumentSecurityDecision =
  | { readonly kind: "ERROR"; readonly failureCode: DocumentMalwareFailureCode }
  | { readonly kind: "CLEAN_CANDIDATE" | "INFECTED_CANDIDATE";
      readonly policyVersion: typeof DOCUMENT_SECURITY_POLICY_VERSION;
      readonly identity: DocumentBytesIdentity };

function error(failureCode: DocumentMalwareFailureCode): DocumentSecurityDecision {
  return { kind: "ERROR", failureCode };
}
function sameBytes(a: DocumentBytesIdentity, b: DocumentBytesIdentity): boolean {
  return a.sizeBytes === b.sizeBytes && a.sha256 === b.sha256;
}

/** Pure evidence classification; does not hash bytes, execute ports, persist or authorize delivery. */
export function decideDocumentSecurity(evidence: unknown): DocumentSecurityDecision {
  const envelope = envelopeSchema.safeParse(evidence);
  if (!envelope.success) return error("INVALID_RESPONSE");
  const input = envelope.data;
  const integrity = integritySchema.safeParse(input.integrity);
  if (!integrity.success || !sameBytes(integrity.data.expected, integrity.data.observed)) {
    return error("INTEGRITY_MISMATCH");
  }
  const identity = integrity.data.expected;
  const pdf = pdfValidationResultSchema.safeParse(input.pdf);
  if (!pdf.success) return error("PDF_VALIDATION_FAILED");
  switch (pdf.data.kind) {
    case "ENCRYPTED": return error("PDF_ENCRYPTED");
    case "INVALID": return error("PDF_INVALID");
    case "UNSUPPORTED":
    case "INDETERMINATE": return error("PDF_UNSUPPORTED");
    case "TIMEOUT": return error("TIMEOUT");
    case "FAILED": return error("PDF_VALIDATION_FAILED");
    case "VALID":
      if (!sameBytes(identity, pdf.data.identity)) return error("INTEGRITY_MISMATCH");
  }
  if (input.signatureHealth !== "TRUSTED") return error("SIGNATURES_UNTRUSTED");
  const scanner = normalizedMalwareEvidenceSchema.safeParse(input.scanner);
  if (!scanner.success) return error("INVALID_RESPONSE");
  switch (scanner.data.kind) {
    case "UNAVAILABLE": return error("SCANNER_UNAVAILABLE");
    case "TIMEOUT": return error("TIMEOUT");
    case "INCOMPLETE": return error("SCAN_INCOMPLETE");
    case "INTERRUPTED": return error("SCANNER_INTERRUPTED");
    case "NOT_READY": return error("SCANNER_NOT_READY");
    case "INVALID_RESPONSE": return error("INVALID_RESPONSE");
    case "OK":
    case "MALWARE_DETECTED":
      if (!sameBytes(identity, scanner.data.identity)) return error("INTEGRITY_MISMATCH");
      return {
        kind: scanner.data.kind === "OK" ? "CLEAN_CANDIDATE" : "INFECTED_CANDIDATE",
        policyVersion: DOCUMENT_SECURITY_POLICY_VERSION,
        identity,
      };
  }
}
