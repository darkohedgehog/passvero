import { healthFixture } from "../helpers/signature-health-fixture";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import { createDocumentScanner } from "../../src/application/documents/scan-document";
import { scanLeaseActive, scanAuditMetadata, trustedProvenance, type DocumentScanClaim, type TerminalScan } from "../../src/application/documents/malware-scan";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import type { NormalizedMalwareEvidence } from "../../src/application/documents/document-security-policy";
import type { PdfValidationResult } from "../../src/application/documents/pdf-validation";
const now = 2_000_000_000;
const bytes = Buffer.from("%PDF synthetic unit input");
const identity = { sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
const health = () => healthFixture(now);
const provenance = trustedProvenance(health(), now)!;
const context: AuthenticatedUserContext = { userId: randomUUID(), organizationId: randomUUID(), membershipId: randomUUID(), membershipRole: "EDITOR", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
function fixture() {
  const claim: DocumentScanClaim = { documentId: randomUUID(), organizationId: context.organizationId, actorId: context.userId, attemptId: randomUUID(), startedAt: now, policyVersion: 2, storage: { provider: "fake", bucket: "private", key: "secret" }, identity };
  const events: string[] = [];
  const results: TerminalScan[] = [];
  const controller = new AbortController();
  const deps = {
    now: () => now,
    persistence: { async claim() { events.push("claim"); return claim; }, async finalize(_c: AuthenticatedUserContext, _claim: DocumentScanClaim, result: TerminalScan) { events.push("finalize"); results.push(result); } },
    storage: { identity: () => claim.storage, async put() {}, async read(_identity: unknown, options?: { signal: AbortSignal; limit: number }) { events.push("read"); assert.equal(options?.limit, 10_485_760); return bytes; } },
    pdf: { async validate(input: Uint8Array): Promise<PdfValidationResult> { events.push("pdf"); assert.deepEqual(Buffer.from(input), bytes); input.fill(0); return { kind: "VALID", identity }; } },
    scanner: { async scan(input: Uint8Array): Promise<NormalizedMalwareEvidence> { events.push("scan"); assert.deepEqual(Buffer.from(input), bytes); return { kind: "OK", complete: true, identity }; } },
    health: { async read(): Promise<unknown> { events.push("health"); return health(); } },
  };
  return { deps, claim, events, results, controller, run: () => createDocumentScanner(deps)(claim.documentId, context, { signal: controller.signal }) };
}
test("owned bytes, PDF then scanner, committed result has no raw/internal evidence", async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { documentId: f.claim.documentId, status: "CLEAN" });
  assert.deepEqual(f.events, ["claim", "read", "pdf", "health", "scan", "health", "finalize"]);
  assert.deepEqual(f.results[0], { status: "CLEAN", identity, provenance });
});
test("integrity mismatch prevents PDF and scan", async () => {
  const f = fixture(); f.deps.storage.read = async () => Buffer.from("bad");
  assert.equal((await f.run()).status, "ERROR");
  assert.deepEqual(f.results, [{ status: "ERROR", failureCode: "INTEGRITY_MISMATCH" }]);
  assert.ok(!f.events.includes("pdf")); assert.ok(!f.events.includes("scan"));
});
for (const [kind, code] of [["ENCRYPTED", "PDF_ENCRYPTED"], ["UNSUPPORTED", "PDF_UNSUPPORTED"], ["INDETERMINATE", "PDF_UNSUPPORTED"], ["TIMEOUT", "TIMEOUT"], ["FAILED", "PDF_VALIDATION_FAILED"]] as const) {
  test(`PDF ${kind} skips scanner`, async () => {
    const f = fixture(); f.deps.pdf.validate = async () => ({ kind });
    await f.run(); assert.deepEqual(f.results, [{ status: "ERROR", failureCode: code }]); assert.ok(!f.events.includes("scan"));
  });
}
for (const [kind, code] of [["INCOMPLETE", "SCAN_INCOMPLETE"], ["UNAVAILABLE", "SCANNER_UNAVAILABLE"], ["TIMEOUT", "TIMEOUT"], ["INTERRUPTED", "SCANNER_INTERRUPTED"], ["NOT_READY", "SCANNER_NOT_READY"], ["INVALID_RESPONSE", "INVALID_RESPONSE"]] as const) {
  test(`scanner ${kind} finalizes symbolic ERROR`, async () => {
    const f = fixture(); f.deps.scanner.scan = async () => ({ kind }); await f.run();
    assert.deepEqual(f.results, [{ status: "ERROR", failureCode: code }]);
  });
}
test("malware normalized evidence persists INFECTED", async () => {
  const f = fixture(); f.deps.scanner.scan = async () => ({ kind: "MALWARE_DETECTED", complete: true, identity });
  assert.equal((await f.run()).status, "INFECTED");
});
test("24h freshness is exclusive; future, missing, failed and incomplete evidence rejected", () => {
  for (const age of [0, 1, 86_399_999]) assert.deepEqual(trustedProvenance({ ...health(), updater: { ...health().updater, completedAt: now - age }, expiresAt: Math.min(now + 60000, now - age + 86400000) }, now), provenance);
  for (const age of [-1, 86_400_000, 86_400_001]) assert.equal(trustedProvenance({ ...health(), updater: { ...health().updater, completedAt: now - age }, expiresAt: Math.min(now + 60000, now - age + 86400000) }, now), null);
  for (const h of [null, {}, { ...health(), unresolvedError: true }, { ...health(), databasesValidated: false }, { ...health(), checkResult: "FAILED" }, { ...health(), loaded: {} }, { ...health(), loaded: { ...provenance, engineVersion: "changed" } }]) assert.equal(trustedProvenance(h, now), null);
});
test("missing health skips scanner, changed provenance discards verdict", async () => {
  const f = fixture(); f.deps.health.read = async () => null; await f.run(); assert.ok(!f.events.includes("scan"));
  assert.deepEqual(f.results, [{ status: "ERROR", failureCode: "SIGNATURES_UNTRUSTED" }]);
  const g = fixture(); let calls = 0;
  g.deps.health.read = async () => ++calls === 1 ? health() : { ...health(), daemon: { ...health().daemon, engineVersion: "changed" } };
  await g.run(); assert.deepEqual(g.results, f.results);
});
test("cancellation before claim does not write; mid-processing finalizes INTERRUPTED under persistence authority", async () => {
  const f = fixture(); f.controller.abort(); await assert.rejects(f.run()); assert.deepEqual(f.events, []);
  const g = fixture(); g.deps.pdf.validate = async () => { g.controller.abort(); return { kind: "FAILED" }; };
  await g.run(); assert.deepEqual(g.results, [{ status: "ERROR", failureCode: "INTERRUPTED" }]);
});
test("finalization rejection never reports scanner success, and no retry", async () => {
  const f = fixture(); let writes = 0; f.deps.persistence.finalize = async () => { writes++; throw new Error("private DB diagnostic"); };
  await assert.rejects(f.run()); assert.equal(writes, 1);
});
test("strict lease and exact minimized audit metadata", () => {
  assert.equal(scanLeaseActive(now, now + 119_999), true);
  assert.equal(scanLeaseActive(now, now + 120_000), false);
  assert.equal(scanLeaseActive(now, now + 120_001), false);
  const f = fixture(); const common = { attemptId: f.claim.attemptId, policyVersion: 2 };
  for (const status of ["CLEAN", "INFECTED"] as const) assert.deepEqual(scanAuditMetadata(f.claim, { status, identity, provenance }), common);
  assert.deepEqual(scanAuditMetadata(f.claim, { status: "ERROR", failureCode: "TIMEOUT" }), { ...common, failureCode: "TIMEOUT" });
});
test("malformed/parser-invalid results, thrown ports and corrupted scanner identity fail closed", async () => {
  const cases: Array<{ mutate: (f: ReturnType<typeof fixture>) => void; code: string }> = [
    { mutate: f => { f.deps.pdf.validate = async () => ({ kind: "INVALID", reason: "STRUCTURE" }); }, code: "PDF_INVALID" },
    { mutate: f => { f.deps.pdf.validate = async () => { throw new Error("secret parser output"); }; }, code: "PDF_VALIDATION_FAILED" },
    { mutate: f => { f.deps.pdf.validate = async () => ({ kind: "VALID", identity: { ...identity, sha256: "a".repeat(64) } }); }, code: "INTEGRITY_MISMATCH" },
    { mutate: f => { f.deps.storage.read = async () => { throw new Error("private key"); }; }, code: "INTEGRITY_MISMATCH" },
    { mutate: f => { f.deps.health.read = async () => { throw new Error("private updater log"); }; }, code: "SIGNATURES_UNTRUSTED" },
    { mutate: f => { f.deps.scanner.scan = async () => { throw new Error("raw scanner response"); }; }, code: "SCANNER_UNAVAILABLE" },
    { mutate: f => { f.deps.scanner.scan = async () => ({ kind: "OK", complete: true, identity: { ...identity, sizeBytes: 1 } }); }, code: "INTEGRITY_MISMATCH" },
    { mutate: f => { f.deps.health.read = async () => ({ ...health(), updater: { ...health().updater, completedAt: now - 86_400_000 } }); }, code: "SIGNATURES_UNTRUSTED" },
  ];
  for (const { mutate, code } of cases) { const f = fixture(); mutate(f); assert.deepEqual(await f.run(), { documentId: f.claim.documentId, status: "ERROR", failureCode: code }); }
});
test("no success before finalization resolves and thrown diagnostics are sanitized", async () => {
  const f = fixture(); let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  let atFinalize!: () => void; const entered = new Promise<void>(r => { atFinalize = r; });
  f.deps.persistence.finalize = async () => { atFinalize(); await gate; };
  let settled = false; const result = f.run().then(r => { settled = true; return r; });
  await entered; assert.equal(settled, false); release(); assert.equal((await result).status, "CLEAN");
  const g = fixture(); g.deps.persistence.finalize = async () => { throw new Error("private database detail"); };
  await assert.rejects(g.run(), e => e instanceof Error && e.message === "OPERATIONAL_FAILURE");
});
test("health must remain fresh after scanning and cancellation after scan cannot persist CLEAN", async () => {
  const f = fixture(); let current = now; f.deps.now = () => current;
  f.deps.scanner.scan = async () => { current = now + 86_400_000; return { kind: "OK", complete: true, identity }; };
  await f.run(); assert.deepEqual(f.results, [{ status: "ERROR", failureCode: "SIGNATURES_UNTRUSTED" }]);
  const g = fixture(); g.deps.scanner.scan = async () => { g.controller.abort(); return { kind: "OK", complete: true, identity }; };
  await g.run(); assert.deepEqual(g.results, [{ status: "ERROR", failureCode: "INTERRUPTED" }]);
});
test("already cancelled bounded stream is released without reading", async () => {
  const { readDocumentBytes } = await import("../../src/application/documents/bytes");
  const controller = new AbortController(); controller.abort(); let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  await assert.rejects(readDocumentBytes(stream, controller.signal));
  assert.equal(cancelled, true); assert.equal(stream.locked, false);
});

test("policy 2 records observable disk/version summary; same-version unseen reload is deliberately unclaimed", async () => {
  const f = fixture(); await f.run();
  const result = f.results[0]; assert.notEqual(result.status, "ERROR");
  if (result.status !== "ERROR") {
    assert.match(result.provenance.signatureVersion, /^obs2:daily:28123;disksha256:[a-f0-9]{64}$/);
    assert.ok(!("daemonIdentity" in result.provenance));
    assert.ok(!("databaseIdentity" in result.provenance));
  }
  // Identical observations cannot expose an intervening same-version reload; no generation claim.
  const g = fixture(); g.deps.health.read = async () => health(); assert.equal((await g.run()).status, "CLEAN");
});
