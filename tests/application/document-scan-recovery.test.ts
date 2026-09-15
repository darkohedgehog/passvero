import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createDocumentScanRecovery } from "../../src/application/documents/recover-document-scan";
import { scanLeaseExpired } from "../../src/application/documents/malware-scan";
import { DocumentError } from "../../src/application/documents/contracts";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const context: AuthenticatedUserContext = { userId: randomUUID(), organizationId: randomUUID(), membershipId: randomUUID(), membershipStatus: "ACTIVE", membershipRole: "EDITOR", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
test("explicit identifiers/context only; return bounded updated or already-closed result", async () => {
  const id = randomUUID(); const attempt = randomUUID();
  for (const status of ["UPDATED", "NO_CHANGE"] as const) {
    let calls = 0;
    const recover = createDocumentScanRecovery({ async recover(actor, documentId, attemptId) { calls++; assert.equal(actor, context); assert.equal(documentId, id); assert.equal(attemptId, attempt); return status; } });
    assert.deepEqual(await recover(id, attempt, context), { documentId: id, status }); assert.equal(calls, 1);
  }
});
test("malformed identifiers reject before persistence; no raw diagnostics or retries", async () => {
  const recover = createDocumentScanRecovery({ async recover() { assert.fail("no persistence"); } });
  await assert.rejects(recover("invalid", randomUUID(), context), /VALIDATION_ERROR/);
  await assert.rejects(recover(randomUUID(), {}, context), /VALIDATION_ERROR/);
  let calls = 0;
  await assert.rejects(createDocumentScanRecovery({ async recover() { calls++; throw new Error("private DB detail"); } })(randomUUID(), randomUUID(), context), /OPERATIONAL_FAILURE/);
  assert.equal(calls, 1);
});
test("existing authorization and conflict errors preserved", async () => {
  for (const code of ["FORBIDDEN", "NOT_FOUND", "NOT_AVAILABLE", "RECOVERY_REQUIRED"] as const) await assert.rejects(createDocumentScanRecovery({ async recover() { throw new DocumentError(code); } })(randomUUID(), randomUUID(), context), e => e instanceof DocumentError && e.code === code);
});
test("lease expires exactly at 120 seconds under trusted time", () => {
  const startedAt = 1_000_000;
  for (const [offset, expected] of [[-1, false], [0, false], [119999, false], [120000, true], [120001, true]] as const) assert.equal(scanLeaseExpired(startedAt, startedAt + offset), expected);
  assert.equal(scanLeaseExpired(NaN, startedAt), false);
});
test("recovery factory imports/constructs independently of scanner config; no external processing", async () => {
  const { execFileSync } = await import("node:child_process");
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import net from 'node:net'; import child from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    let effects=0;
    const blocked=()=>{effects++;throw new Error('unexpected side effect')};
    net.Socket.prototype.connect=blocked;child.spawn=blocked;globalThis.fetch=blocked;syncBuiltinESMExports();
    const m=await import('./src/infrastructure/documents/document-scan-recovery-runtime.ts');
    const create=m.createDocumentScanRecoveryRuntime??m.default.createDocumentScanRecoveryRuntime;
    const runtime=create(blocked);assert.equal(effects,0);
    await assert.rejects(runtime.recover('invalid','invalid',{}),/VALIDATION_ERROR/);
    assert.equal(effects,0);console.log('INERT=PASS');
  `], { cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: "test" }, encoding: "utf8", timeout: 15000 });
  assert.match(output, /INERT=PASS/);
});
