import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runRecoveryRead, type RecoveryConfig } from "../../scripts/staging-recovery/application_read";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function fixture(fault?: string) {
  const org = "11111111-1111-4111-8111-111111111111";
  const id = "22222222-2222-4222-8222-222222222222";
  const version = "33333333-3333-4333-8333-333333333333";
  const imageId = "44444444-4444-4444-8444-444444444444";
  const member = { id: "55555555-5555-4555-8555-555555555555", userId: "66666666-6666-4666-8666-666666666666", organizationId: org, role: "OWNER", status: "ACTIVE" };
  const product = { id, organizationId: org, internalName: "Private recovery fixture", sku: null,
    lifecycleStatus: "ACTIVE", updatedAt: "2026-10-01T00:00:00.000Z", currentDraftVersionId: version, currentPublishedVersionId: null };
  const imageBytes = new Uint8Array([137,80,78,71,13,10,26,10]);
  const pdfBytes = new TextEncoder().encode("%PDF-1.4\nsynthetic private bytes\n");
  const image = { id: imageId, organizationId: org, storageProvider: "supabase", storageBucket: "passvero-staging-images", storageKey: "fixture/image",
    mimeType: "image/png", sizeBytes: String(imageBytes.length), checksumSha256: hash(imageBytes), width: 1, height: 1, state: "READY", policyVersion: 1 };
  const document = { id, originalFilename: "fixture.pdf", mimeType: "application/pdf", storageProvider: "supabase", storageBucket: "passvero-staging-documents",
    storageKey: "fixture/document", sizeBytes: String(pdfBytes.length), checksumSha256: hash(pdfBytes), status: "AVAILABLE" };
  const objects = [image,document].map(a => ({ bucket: a.storageBucket, key: a.storageKey,
    file: createHash("sha256").update(a.storageBucket + "\0" + a.storageKey).digest("hex"), size: Number(a.sizeBytes), sha256: a.checksumSha256 }));
  const config: RecoveryConfig = { source: "/private-fixture", socket: "/isolated/socket", database: "passvero_staging_recovery", objects };
  if (fault === "missing") config.objects = objects.slice(1);
  let imageReads = 0;
  const calls: string[] = [];
  const query = <T>(sql: string): T => {
    calls.push(sql);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/);
    const marker = /recovery:([a-z]+)/.exec(sql)?.[1];
    let result: unknown;
    switch (marker) {
      case "candidate": result = { product, membership: fault === "membership" ? { ...member, organizationId: id } : member, imageId }; break;
      case "actor": result = fault === "actor" ? 0 : 1; break;
      case "product": result = fault === "tenant" ? { ...product, organizationId: id } : product; break;
      case "version": result = { id: version, productId: id, organizationId: org, status: "DRAFT", sourceLocale: "hr", versionNumber: null, updatedAt: product.updatedAt }; break;
      case "identifiers": result = []; break;
      case "manufacturer": result = null; break;
      case "image": imageReads += 1; result = fault === "image_state" ? { ...image, state: "LEGACY" }
        : fault === "recheck" && imageReads === 2 ? { ...image, checksumSha256: "f".repeat(64) } : image; break;
      case "document": result = document; break;
      default: throw new Error("Unexpected SQL marker");
    }
    return result as T;
  };
  const readFile = (file: string) => {
    if (file.includes("passvero-staging-images")) return fault === "image_bytes" ? new Uint8Array([0]) : imageBytes;
    return fault === "pdf_bytes" ? new Uint8Array([0]) : pdfBytes;
  };
  return { config, ports: { query, readFile }, calls, imageReads: () => imageReads };
}

test("application catalog/PDF/image reads use readonly restored ports without exposing product data", async () => {
  const f = fixture(); const result = await runRecoveryRead(f.config, f.ports);
  assert.equal(result.applicationRead, "PASS_PRIVATE_RECOVERY_PORTS");
  assert.equal(result.pdf, "PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA");
  assert.equal(result.image, "PASS_APPLICATION_DOWNLOAD_AND_RECHECK");
  assert.equal(f.imageReads(), 2);
  assert.equal(result.freshScannerTrustRecovery, "NOT_TESTED");
  assert.equal(result.authSessionRecovery, "NOT_TESTED");
  assert.equal(result.schemaWrites, "NONE");
  assert.equal(result.smtpCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /Private recovery fixture|fixture\.pdf/);
});
for (const fault of ["membership", "actor", "tenant", "missing", "image_state", "recheck", "image_bytes", "pdf_bytes"]) {
  test(`private recovery read rejects ${fault}`, async () => {
    const f = fixture(fault); await assert.rejects(runRecoveryRead(f.config, f.ports));
  });
}
test("private recovery rejects a production database name before any SQL", async () => {
  const f = fixture();
  await assert.rejects(runRecoveryRead({ ...f.config, database: "passvero" as RecoveryConfig["database"] }, f.ports));
  assert.equal(f.calls.length, 0);
});
