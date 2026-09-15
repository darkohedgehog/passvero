import assert from "node:assert/strict";
import test from "node:test";
import {
  decideDocumentSecurity, DOCUMENT_SECURITY_POLICY_VERSION,
  documentMalwareFailureCodeSchema,
} from "../../src/application/documents/document-security-policy";
import { pdfValidationResultSchema } from "../../src/application/documents/pdf-validation";

const identity = { sizeBytes: 687, sha256: "a".repeat(64) };
const clean = () => ({
  policyVersion: DOCUMENT_SECURITY_POLICY_VERSION,
  integrity: { expected: identity, observed: identity },
  pdf: { kind: "VALID", identity },
  scanner: { kind: "OK", complete: true, identity },
  signatureHealth: "TRUSTED",
});
const error = (failureCode: string) => ({ kind: "ERROR", failureCode });

test("complete matching evidence produces only a policy-bound candidate", () => {
  assert.deepEqual(decideDocumentSecurity(clean()), { kind: "CLEAN_CANDIDATE", policyVersion: 2, identity });
  assert.deepEqual(decideDocumentSecurity({ ...clean(), scanner: { kind: "MALWARE_DETECTED", complete: true, identity } }), {
    kind: "INFECTED_CANDIDATE", policyVersion: 2, identity,
  });
});

for (const [pdf, code] of [
  [{ kind: "ENCRYPTED" }, "PDF_ENCRYPTED"],
  [{ kind: "INVALID", reason: "STRUCTURE" }, "PDF_INVALID"],
  [{ kind: "INVALID", reason: "WARNING" }, "PDF_INVALID"],
  [{ kind: "INVALID", reason: "RECOVERY" }, "PDF_INVALID"],
  [{ kind: "UNSUPPORTED" }, "PDF_UNSUPPORTED"],
  [{ kind: "INDETERMINATE" }, "PDF_UNSUPPORTED"],
  [{ kind: "TIMEOUT" }, "TIMEOUT"],
  [{ kind: "FAILED" }, "PDF_VALIDATION_FAILED"],
  [undefined, "PDF_VALIDATION_FAILED"],
  [{ kind: "UNKNOWN" }, "PDF_VALIDATION_FAILED"],
] as const) {
  test(`PDF ${JSON.stringify(pdf)} cannot be overridden by scanner OK`, () => {
    assert.deepEqual(decideDocumentSecurity({ ...clean(), pdf }), error(code));
  });
}
for (const [kind, code] of [
  ["UNAVAILABLE", "SCANNER_UNAVAILABLE"], ["TIMEOUT", "TIMEOUT"],
  ["INCOMPLETE", "SCAN_INCOMPLETE"], ["INTERRUPTED", "SCANNER_INTERRUPTED"],
  ["NOT_READY", "SCANNER_NOT_READY"], ["INVALID_RESPONSE", "INVALID_RESPONSE"],
  ["FOUND", "INVALID_RESPONSE"],
] as const) {
  test(`scanner ${kind} is an ERROR, never an infected candidate`, () => {
    assert.deepEqual(decideDocumentSecurity({ ...clean(), scanner: { kind } }), error(code));
  });
}

test("missing, contradictory and diagnostic-bearing evidence fails closed", () => {
  for (const scanner of [undefined, null, { kind: "OK", complete: false, identity },
    { kind: "OK", complete: true, identity, rawOutput: "secret" },
    { kind: "MALWARE_DETECTED", complete: false, identity }]) {
    assert.deepEqual(decideDocumentSecurity({ ...clean(), scanner }), error("INVALID_RESPONSE"));
  }
  assert.deepEqual(decideDocumentSecurity({ ...clean(), pdf: { kind: "VALID", identity, warning: true } }), error("PDF_VALIDATION_FAILED"));
  assert.equal(pdfValidationResultSchema.safeParse({ kind: "FAILED", diagnostics: "secret" }).success, false);
  assert.deepEqual(decideDocumentSecurity({ ...clean(), unexpected: true }), error("INVALID_RESPONSE"));
  assert.deepEqual(decideDocumentSecurity(null), error("INVALID_RESPONSE"));
});

test("all three evidence identities bind size and lowercase SHA-256", () => {
  for (const changed of [{ ...identity, sizeBytes: 688 }, { ...identity, sha256: "b".repeat(64) }]) {
    assert.deepEqual(decideDocumentSecurity({ ...clean(), integrity: { expected: identity, observed: changed } }), error("INTEGRITY_MISMATCH"));
    assert.deepEqual(decideDocumentSecurity({ ...clean(), pdf: { kind: "VALID", identity: changed } }), error("INTEGRITY_MISMATCH"));
    assert.deepEqual(decideDocumentSecurity({ ...clean(), scanner: { kind: "OK", complete: true, identity: changed } }), error("INTEGRITY_MISMATCH"));
  }
  for (const invalid of [{ ...identity, sizeBytes: 0 }, { ...identity, sizeBytes: 10485761 }, { ...identity, sha256: "A".repeat(64) }]) {
    assert.deepEqual(decideDocumentSecurity({ ...clean(), integrity: { expected: invalid, observed: invalid } }), error("INTEGRITY_MISMATCH"));
  }
  assert.deepEqual(decideDocumentSecurity({ ...clean(), integrity: undefined }), error("INTEGRITY_MISMATCH"));
});

test("untrusted or absent signature health excludes both trustworthy verdicts", () => {
  for (const signatureHealth of [undefined, null, "UNKNOWN", "UNTRUSTED", true]) {
    for (const kind of ["OK", "MALWARE_DETECTED"]) {
      assert.deepEqual(decideDocumentSecurity({ ...clean(), signatureHealth, scanner: { kind, complete: true, identity } }), error("SIGNATURES_UNTRUSTED"));
    }
  }
});

test("precedence is policy envelope, integrity, PDF, signatures, scanner", () => {
  const conflicting = { ...clean(), pdf: { kind: "ENCRYPTED" }, signatureHealth: "UNTRUSTED", scanner: { kind: "TIMEOUT" } };
  assert.deepEqual(decideDocumentSecurity({ ...conflicting, policyVersion: 1, integrity: undefined }), error("INVALID_RESPONSE"));
  assert.deepEqual(decideDocumentSecurity({ ...conflicting, integrity: undefined }), error("INTEGRITY_MISMATCH"));
  assert.deepEqual(decideDocumentSecurity(conflicting), error("PDF_ENCRYPTED"));
  assert.deepEqual(decideDocumentSecurity({ ...conflicting, pdf: clean().pdf }), error("SIGNATURES_UNTRUSTED"));
  assert.deepEqual(decideDocumentSecurity({ ...conflicting, pdf: clean().pdf, signatureHealth: "TRUSTED" }), error("TIMEOUT"));
});

test("failure codes fit the existing persistence CHECK and reject raw text", () => {
  for (const code of documentMalwareFailureCodeSchema.options) {
    assert.match(code, /^[A-Z][A-Z0-9_]{0,63}$/);
  }
  assert.equal(documentMalwareFailureCodeSchema.safeParse("parser error: /private/file.pdf").success, false);
  assert.deepEqual(decideDocumentSecurity({ ...clean(), pdf: { kind: "FAILED", rawOutput: "secret" } }), error("PDF_VALIDATION_FAILED"));
});
