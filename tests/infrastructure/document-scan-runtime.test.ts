import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDocumentScanConfig } from "../../src/infrastructure/documents/document-scan-config";
import { createDocumentScanRuntimeCore, type DocumentScanRuntimeFactories } from "../../src/infrastructure/documents/document-scan-runtime-core";
import { createSignatureHealthProvider } from "../../src/infrastructure/documents/signature-health-reader";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import type { TerminalScan } from "../../src/application/documents/malware-scan";
import { DocumentError } from "../../src/application/documents/contracts";
const config = { qpdfLauncherPath: "/usr/local/libexec/passvero-qpdf-launch", qpdfTemporaryRoot: "/run/passvero-qpdf/input", clamavSocketPath: "/run/clamav/clamd.ctl", healthEvidencePath: "/var/lib/passvero/health.json", malwareSignatures: ["Synthetic.Malware-1"] };
const context: AuthenticatedUserContext = { userId: randomUUID(), membershipId: randomUUID(), organizationId: randomUUID(), membershipStatus: "ACTIVE", membershipRole: "EDITOR", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
function fixture() {
  const count = { persistence: 0, storage: 0, pdf: 0, scanner: 0, health: 0, scan: 0 };
  const bytes = Buffer.from("%PDF synthetic composition"); const identity = { sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const results: TerminalScan[] = [];
  const provenance = { scanner: "clamav", engineVersion: "1", signatureVersion: "1", databaseIdentity: "db-1", daemonIdentity: "epoch-1" };
  let epoch = "epoch-1";
  const factories: DocumentScanRuntimeFactories = {
    persistence() { count.persistence++; return { async claim(actor, id) { assert.equal(actor, context); return { documentId: id, organizationId: actor.organizationId, actorId: actor.userId, attemptId: randomUUID(), startedAt: Date.now(), policyVersion: 1, identity, storage: { provider: "fake", bucket: "private", key: "private" } }; }, async finalize(actor, _claim, result) { assert.equal(actor, context); results.push(result); } }; },
    storage() { count.storage++; return { identity: () => ({ provider: "fake", bucket: "private", key: "private" }), async put() {}, async read() { return bytes; } }; },
    pdf(actual) { count.pdf++; assert.deepEqual(actual, { executablePath: config.qpdfLauncherPath, temporaryRoot: config.qpdfTemporaryRoot }); return { async validate() { return { kind: "VALID", identity }; } }; },
    scanner(path, signatures) { count.scanner++; assert.equal(path, config.clamavSocketPath); assert.deepEqual([...signatures], config.malwareSignatures); return { async scan() { count.scan++; return { kind: "OK", complete: true, identity }; } }; },
    health(actual) { count.health++; return createSignatureHealthProvider(actual, { async read(path) { assert.equal(path, config.healthEvidencePath); const now = Date.now(); return Buffer.from(JSON.stringify({ schemaVersion: 1, socketPath: config.clamavSocketPath, capturedAt: now, expiresAt: now + 1000, evidence: { lastSuccessfulVerifiedCheckAt: now, checkResult: "ALREADY_CURRENT", databasesValidated: true, unresolvedError: false, validated: { ...provenance, daemonIdentity: epoch }, loaded: { ...provenance, daemonIdentity: epoch } } })); } }); },
  };
  return { factories, count, results, setEpoch: (next: string) => { epoch = next; } };
}
const options = () => ({ signal: new AbortController().signal });
test("strict config rejects missing paths, qpdf bypass, wildcard, empty, duplicate and ambiguous signatures", () => {
  assert.deepEqual(parseDocumentScanConfig(config), config);
  for (const value of [undefined, {}, { ...config, extra: true }, { ...config, qpdfLauncherPath: "/usr/bin/qpdf" }, { ...config, qpdfTemporaryRoot: "/tmp" }, { ...config, clamavSocketPath: "127.0.0.1:3310" }, { ...config, healthEvidencePath: "/run/../health" }]) assert.throws(() => parseDocumentScanConfig(value), /OPERATIONAL_FAILURE/);
  for (const signatures of [[], ["*"], ["a.*"], [" x"], ["a", "a"], ["a", "A"], ["Heuristics.Encrypted.PDF"], ["PUA.Test"], ["x".repeat(257)], Array.from({ length: 257 }, (_, i) => `Synthetic.${i}`)]) assert.throws(() => parseDocumentScanConfig({ ...config, malwareSignatures: signatures }));
});
test("construction is inert, input config snapshotted, adapters reused and trusted context preserved", async () => {
  const f = fixture(); const input = { ...config, malwareSignatures: [...config.malwareSignatures] };
  const runtime = createDocumentScanRuntimeCore(input, f.factories);
  assert.ok(Object.values(f.count).every(n => n === 0)); input.clamavSocketPath = "/run/untrusted"; input.malwareSignatures.push("Other");
  for (let i = 0; i < 2; i++) assert.equal((await runtime.scan(randomUUID(), context, options())).status, "CLEAN");
  assert.deepEqual(f.count, { persistence: 1, storage: 1, pdf: 1, scanner: 1, health: 1, scan: 2 });
});
test("missing config and constructor errors are normalized without accessing other runtimes", async () => {
  const f = fixture(); const runtime = createDocumentScanRuntimeCore(undefined, f.factories);
  await assert.rejects(runtime.scan(randomUUID(), context, options()), /OPERATIONAL_FAILURE/); assert.ok(Object.values(f.count).every(n => n === 0));
  f.factories.storage = () => { throw new Error("private credentials"); };
  await assert.rejects(createDocumentScanRuntimeCore(config, f.factories).scan(randomUUID(), context, options()), e => e instanceof DocumentError && e.message === "OPERATIONAL_FAILURE");
  assert.doesNotMatch(readFileSync("src/infrastructure/documents/document-runtime.ts", "utf8"), /document-scan-runtime/);
});
test("missing evidence and changed producer epoch fail closed", async () => {
  const f = fixture(); f.factories.health = () => createSignatureHealthProvider({ path: config.healthEvidencePath, socketPath: config.clamavSocketPath }, { async read() { throw new Error("missing private source"); } });
  assert.equal((await createDocumentScanRuntimeCore(config, f.factories).scan(randomUUID(), context, options())).status, "ERROR"); assert.equal(f.count.scan, 0);
  const g = fixture(); const original = g.factories.scanner;
  g.factories.scanner = (path, names) => { const scanner = original(path, names); return { async scan(bytes, o) { const result = await scanner.scan(bytes, o); g.setEpoch("epoch-2"); return result; } }; };
  const result = await createDocumentScanRuntimeCore(config, g.factories).scan(randomUUID(), context, options());
  assert.deepEqual(result.status === "ERROR" ? result.failureCode : undefined, "SIGNATURES_UNTRUSTED");
});
test("active/expired rejection propagates unchanged, without processing or recovery", async () => {
  for (const code of ["NOT_AVAILABLE", "RECOVERY_REQUIRED"] as const) {
    const f = fixture(); f.factories.persistence = () => ({ async claim() { throw new DocumentError(code); }, async finalize() { assert.fail("no finalization"); } });
    await assert.rejects(createDocumentScanRuntimeCore(config, f.factories).scan(randomUUID(), context, options()), e => e instanceof DocumentError && e.code === code);
    assert.equal(f.count.scan, 0); assert.deepEqual(f.results, []);
  }
});
test("concurrent calls retain the same scanner slot without construction per call", async () => {
  const f = fixture(); let release!: () => void; let entered!: () => void;
  const entry = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  f.factories.scanner = () => { f.count.scanner++; let busy = false; return { async scan() { if (busy) return { kind: "NOT_READY" }; busy = true; entered(); await wait; busy = false; return { kind: "INCOMPLETE" }; } }; };
  const runtime = createDocumentScanRuntimeCore(config, f.factories);
  const first = runtime.scan(randomUUID(), context, options()); await entry;
  const second = await runtime.scan(randomUUID(), context, options());
  assert.equal(second.status === "ERROR" ? second.failureCode : null, "SCANNER_NOT_READY");
  release(); await first; assert.equal(f.count.scanner, 1);
});
test("server-only runtime import and construction perform no network, subprocess or Prisma work", async () => {
  const { execFileSync } = await import("node:child_process");
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import net from 'node:net';
    import child from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    let effects=0;
    const blocked=()=>{effects++;throw new Error('unexpected runtime I/O')};
    net.Socket.prototype.connect=blocked;child.spawn=blocked;globalThis.fetch=blocked;syncBuiltinESMExports();
    const loaded=await import('./src/infrastructure/documents/document-scan-runtime.ts');
    const create=loaded.createDocumentScanRuntime??loaded.default.createDocumentScanRuntime;
    const deps={getPrisma:blocked,storageConfig:undefined};
    create(${JSON.stringify(config)},deps);
    const missing=create(undefined,deps);
    await assert.rejects(missing.scan('invalid',{}, {signal:new AbortController().signal}),/OPERATIONAL_FAILURE/);
    assert.equal(effects,0);
    console.log('INERT_IMPORT_AND_CONSTRUCTION=PASS');
  `], { cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: "test" }, encoding: "utf8", timeout: 15000 });
  assert.match(output, /INERT_IMPORT_AND_CONSTRUCTION=PASS/);
});
