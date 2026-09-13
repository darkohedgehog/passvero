import assert from "node:assert/strict";
import test from "node:test";
import { attachmentMetadataSchema, attachmentCommandSchema, attachmentDto, type AttachmentRow } from "../../src/application/products/document-attachments/contracts";
import { createUploadAttachmentFlow } from "../../src/application/products/document-attachments/ui-client";
const evidence = { expectedDraftVersionId: "11111111-1111-4111-8111-111111111111", expectedProductUpdatedAt: "2026-09-01T00:00:00.000Z", expectedDraftUpdatedAt: "2026-09-01T00:00:00.000Z" };
const documentId = "22222222-2222-4222-8222-222222222222";
const metadata = { category: "MANUAL" as const, locale: null, displayLabel: "Manual", description: null, isPublic: false };
for (const category of ["CERTIFICATE", "DECLARATION", "MANUAL", "OTHER"]) test(`category ${category}`, () => assert.ok(attachmentMetadataSchema.safeParse({ ...metadata, category }).success));
for (const locale of [null, "hr", "en", "de", "sr", "sl", "pl"]) test(`locale ${locale} needs no translation`, () => assert.ok(attachmentMetadataSchema.safeParse({ ...metadata, locale }).success));
for (const change of [{ category: "EVIL" }, { locale: "fr" }, { displayLabel: null }, { displayLabel: " " }, { displayLabel: "a".repeat(201) }, { displayLabel: "x\u202ey" }, { description: "a".repeat(2001) }, { description: "x\0y" }, { isPublic: undefined }, { isPublic: "true" }, { storageKey: "extra" }]) test(`strict metadata rejects ${JSON.stringify(change).slice(0,55)}`, () => assert.equal(attachmentMetadataSchema.safeParse({ ...metadata, ...change }).success, false));
test("NFC trim, Unicode code points, optional plain text", () => {
 assert.deepEqual(attachmentMetadataSchema.parse({ ...metadata, displayLabel: " e\u0301 ", description: "  " }), { ...metadata, displayLabel: "é" });
 assert.ok(attachmentMetadataSchema.safeParse({ ...metadata, displayLabel: "😀".repeat(200), description: "line 1\nline 2 <literal>" }).success);
});
test("commands reject unknown fields, bad CAS and implicit public default", () => {
 const body = { ...evidence, operation: "ATTACH", documentId, metadata };
 assert.ok(attachmentCommandSchema.safeParse(body).success);
 for (const change of [{ organizationId: documentId }, { expectedDraftVersionId: "bad" }, { expectedDraftUpdatedAt: "tomorrow" }, { metadata: { ...metadata, isPublic: undefined } }]) assert.equal(attachmentCommandSchema.safeParse({ ...body, ...change }).success, false);
});
test("private DTO allowlist and safe legacy label never uses filename", () => {
 const row: AttachmentRow = { id: documentId, productVersionId: evidence.expectedDraftVersionId, documentId, ...metadata, displayLabel: null, isPrimary: false, sortOrder: 0, updatedAt: new Date(), document: { organizationId: "org", status: "AVAILABLE" } };
 const dto = attachmentDto(row, row.productVersionId, "org");
 assert.equal(dto.displayLabel, null); assert.equal(dto.downloadUrl, `/api/documents/${documentId}`);
 assert.deepEqual(Object.keys(dto).sort(), ["id","documentId","category","locale","displayLabel","description","isPublic","sortOrder","updatedAt","availability","downloadUrl"].sort());
 assert.throws(() => attachmentDto(row, row.productVersionId, "foreign"));
 assert.equal(attachmentDto({ ...row, document: { organizationId: "org", status: "FAILED" } }, row.productVersionId, "org").downloadUrl, null);
});
const file = new File(["%PDF-1.4 test"], "proof.pdf", { type: "application/pdf" });
test("failed attach reuses same private handle on explicit retry, never uploads twice", async () => {
 const calls: Array<{ url: string; body: unknown }> = []; let attachCount = 0;
 const transport: typeof fetch = async (url, init) => {
  calls.push({ url: String(url), body: init?.body });
  if (url === "/api/documents") return Response.json({ status: "AVAILABLE", documentId }, { status: 201 });
  return Response.json({ status: ++attachCount === 1 ? "OPERATIONAL_FAILURE" : "ATTACHED" }, { status: attachCount === 1 ? 503 : 200 });
 };
 const flow = createUploadAttachmentFlow("product", evidence, transport);
 await assert.rejects(flow.submit(file, metadata, evidence)); assert.equal(flow.uploaded, true);
 await flow.submit(null, metadata, evidence);
 assert.equal(calls.filter(c => c.url === "/api/documents").length, 1);
 assert.equal(JSON.parse(String(calls[2].body)).documentId, documentId);
 await assert.rejects(flow.submit(file, metadata, evidence)); assert.equal(calls.length, 3);
});
test("stale Product or draft evidence never silently adopts a new draft or uploads", async () => {
 let calls = 0; const flow = createUploadAttachmentFlow("p", evidence, async () => { calls++; throw new Error(); });
 await assert.rejects(flow.submit(file, metadata, { ...evidence, expectedDraftVersionId: documentId })); assert.equal(calls, 0);
});
test("upload uncertainty cannot trigger another upload", async () => {
 let calls = 0; const flow = createUploadAttachmentFlow("p", evidence, async () => { calls++; throw new Error(); });
 await assert.rejects(flow.submit(file, metadata, evidence)); await assert.rejects(flow.submit(file, metadata, evidence)); assert.equal(calls, 1);
});
test("concurrent UI submissions perform a single upload", async () => {
 let calls=0; let release!: () => void; const gate = new Promise<void>(r => { release=r; });
 const flow=createUploadAttachmentFlow("p",evidence,async url=>{ calls++; if(url==="/api/documents"){await gate;return Response.json({status:"AVAILABLE",documentId},{status:201});} return Response.json({status:"ATTACHED"}); });
 const first=flow.submit(file,metadata,evidence);await assert.rejects(flow.submit(file,metadata,evidence));release();await first;assert.equal(calls,2);
});
