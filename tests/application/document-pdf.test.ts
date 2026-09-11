import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { validatePdf, MAX_DOCUMENT_PDF_SIZE } from "../../src/application/documents/pdf";
const bytes = Buffer.from("%PDF-1.7\nprivate fixture");
test("valid PDF, uppercase extension, checksum and filename normalization", () => {
  const result = validatePdf({ filename: "C:\\uploads\\proof.PDF", mimeType: "application/pdf", bytes });
  assert.equal(result.originalFilename, "proof.PDF");
  assert.equal(result.checksumSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(result.sizeBytes, bytes.length);
  assert.equal(validatePdf({ filename: "/tmp/a.pdf", mimeType: "application/pdf", bytes }).originalFilename, "a.pdf");
});
for (const filename of ["a.txt", "a.pdf.exe", "a\r.pdf", "a\n.pdf", "a\0.pdf", "a\u0001.pdf", "a\u007f.pdf", "a".repeat(197)+".pdf"]) {
  test(`reject invalid filename ${JSON.stringify(filename)}`, () => assert.throws(() => validatePdf({filename,mimeType:"application/pdf",bytes})));
}
for (const mimeType of ["text/plain", "application/octet-stream", "application/pdf; charset=utf-8"]) test(`reject wrong MIME ${mimeType}`,()=>assert.throws(()=>validatePdf({filename:"a.pdf",mimeType,bytes})));
test("reject false PDF and empty PDF",()=>{
  for(const invalid of [Buffer.from("not PDF"),Buffer.alloc(0)]) assert.throws(()=>validatePdf({filename:"a.pdf",mimeType:"application/pdf",bytes:invalid}));
});
test("exact 10 MiB accepted; greater rejected",()=>{
  const full=Buffer.alloc(MAX_DOCUMENT_PDF_SIZE);full.write("%PDF-");
  assert.equal(validatePdf({filename:"a.pdf",mimeType:"application/pdf",bytes:full}).sizeBytes,MAX_DOCUMENT_PDF_SIZE);
  assert.throws(()=>validatePdf({filename:"a.pdf",mimeType:"application/pdf",bytes:Buffer.concat([full,Buffer.from("x")])}));
});
test("PDF signature matches literal bytes, not high-bit ASCII aliases",()=>{
 const bytes=Buffer.from([0xa5,0xd0,0xc4,0xc6,0xad]);
 assert.throws(()=>validatePdf({filename:"a.pdf",mimeType:"application/pdf",bytes}));
});
