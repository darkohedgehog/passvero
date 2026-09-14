import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQpdfValidationPort } from "../../src/infrastructure/documents/qpdf-validation";
import { sha256 } from "../../src/application/documents/pdf";

const qpdf = "/opt/homebrew/Cellar/qpdf/12.4.0/bin/qpdf";
function pdf(): Buffer {
  const stream = "BT /F1 12 Tf 20 20 Td (Synthetic acceptance) Tj ET\n";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}endstream`];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(text.length); text += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = text.length;
  text += "xref\n0 6\n0000000000 65535 f \n" + offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(text + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

test("real qpdf 12.4.0: finite reconstructed PDF fixtures", async t => {
  assert.match(execFileSync(qpdf, ["--version"], { encoding: "utf8" }), /qpdf version 12\.4\.0/);
  const root = await mkdtemp(join(tmpdir(), "qpdf-real-test-"));
  try {
    const temporaryRoot = join(root, "validation"); await mkdir(temporaryRoot);
    const source = join(root, "source.pdf"); const original = pdf(); await writeFile(source, original);
    const encrypted = join(root, "encrypted.pdf"); const empty = join(root, "empty-password.pdf");
    execFileSync(qpdf, ["--encrypt", "synthetic-user", "synthetic-owner", "256", "--", source, encrypted]);
    execFileSync(qpdf, ["--encrypt", "", "synthetic-owner", "256", "--", source, empty]);
    const recoveryBytes = Buffer.from(original.toString().replace(/startxref\n\d+/, "startxref\n0"));
    const recoveryPath = join(root, "recovery.pdf"); await writeFile(recoveryPath, recoveryBytes);
    assert.equal(spawnSync(qpdf, ["--check", recoveryPath], { stdio: "pipe" }).status, 3);
    const cases = [
      { name: "valid unencrypted PDF", bytes: original, expected: "VALID" },
      { name: "truncated inside stream, missing xref/trailer", bytes: original.subarray(0, original.indexOf("stream\n") + 15), expected: "INVALID" },
      { name: "missing page-tree object 9, same-width reference", bytes: Buffer.from(original.toString().replace("/Pages 2 0 R", "/Pages 9 0 R")), expected: "INVALID" },
      { name: "password encryption", bytes: await readFile(encrypted), expected: "ENCRYPTED" },
      { name: "empty-user-password encryption", bytes: await readFile(empty), expected: "ENCRYPTED" },
      { name: "invalid xref requires recovery; default check warns", bytes: recoveryBytes, expected: "INVALID" },
      { name: "non-PDF text", bytes: Buffer.from("synthetic non-PDF"), expected: "INVALID" },
    ];
    const adapter = createQpdfValidationPort({ executablePath: qpdf, temporaryRoot });
    for (const fixture of cases) {
      await t.test(fixture.name, async () => {
        const before = Buffer.from(fixture.bytes);
        const result = await adapter.validate(fixture.bytes, { signal: new AbortController().signal });
        assert.equal(result.kind, fixture.expected);
        if (fixture.expected === "INVALID") assert.deepEqual(result, { kind: "INVALID", reason: "STRUCTURE" });
        if (result.kind === "VALID") assert.deepEqual(result.identity, { sizeBytes: before.length, sha256: sha256(before) });
        assert.deepEqual(fixture.bytes, before); assert.deepEqual(await readdir(temporaryRoot), []);
        t.diagnostic(`${fixture.name}: ${result.kind}`);
      });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

async function processCase(body: string, action: (adapter: ReturnType<typeof createQpdfValidationPort>, root: string, trace: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "qpdf-process-test-"));
  try {
    const temporaryRoot = join(root, "validation"); await mkdir(temporaryRoot);
    const trace = join(root, "trace.jsonl"); const executable = join(root, "double.cjs");
    const prefix = `#!${process.execPath}\nconst fs=require('node:fs');const crypto=require('node:crypto');const file=process.argv.at(-1);fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({pid:process.pid,mode:fs.statSync(file).mode&511,dirMode:fs.statSync(require('node:path').dirname(file)).mode&511,hash:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),secretPresent:Object.keys(process.env).some(k=>k.includes('SYNTHETIC_SECRET')),args:process.argv.slice(2)})+'\\n');\n`;
    await writeFile(executable, prefix + body, { mode: 0o700 });
    await action(createQpdfValidationPort({ executablePath: executable, temporaryRoot }), temporaryRoot, trace);
    assert.deepEqual(await readdir(temporaryRoot), []);
    const entries = (await readFile(trace, "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { pid: number });
    for (const { pid } of entries) assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  } finally { await rm(root, { recursive: true, force: true }); }
}
const signal = () => new AbortController().signal;
for (const [exit, expected] of [[0, { kind: "VALID" }], [2, { kind: "INVALID", reason: "STRUCTURE" }], [3, { kind: "INVALID", reason: "WARNING" }], [7, { kind: "FAILED" }]] as const) {
  test(`process double: structural exit ${exit}`, async () => {
    await processCase(`process.exit(process.argv.includes('--is-encrypted')?2:${exit});`, async adapter => {
      const result = await adapter.validate(pdf(), { signal: signal() });
      if (result.kind === "VALID") assert.equal(expected.kind, "VALID"); else assert.deepEqual(result, expected);
    });
  });
}
test("process double: shared ten-second deadline, SIGKILL escalation and reaping", async () => {
  await processCase("process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(process.argv.includes('--is-encrypted')?2:0),6000);", async adapter => {
    const start = performance.now();
    assert.deepEqual(await adapter.validate(pdf(), { signal: signal() }), { kind: "TIMEOUT" });
    assert.ok(performance.now() - start >= 9900); assert.ok(performance.now() - start < 12000);
  });
});
test("process double: already-aborted, mid-flight abort and busy have no pending queue", async () => {
  await processCase("process.on('SIGTERM',()=>{});setInterval(()=>{},1000);", async (adapter, _root, trace) => {
    const before = new AbortController(); before.abort();
    assert.deepEqual(await adapter.validate(pdf(), { signal: before.signal }), { kind: "FAILED" });
    const abort = new AbortController(); const pending = adapter.validate(pdf(), { signal: abort.signal });
    for (let i = 0; i < 100; i++) { if (await readFile(trace).then(() => true, () => false)) break; await new Promise(r => setTimeout(r, 10)); }
    assert.deepEqual(await adapter.validate(pdf(), { signal: signal() }), { kind: "FAILED" });
    abort.abort(); assert.deepEqual(await pending, { kind: "FAILED" });
  });
});
for (const [name, body] of [
  ["overflow", "process.stdout.write(Buffer.alloc(65537,120));setInterval(()=>{},1000);"],
  ["crash", "process.kill(process.pid,'SIGKILL');"],
  ["contradictory stderr", "process.stderr.write('raw private diagnostic');process.exit(process.argv.includes('--is-encrypted')?2:0);"],
] as const) {
  test(`process double: ${name} is sanitized and cleaned`, async () => processCase(body, async adapter => {
    assert.deepEqual(await adapter.validate(pdf(), { signal: signal() }), { kind: "FAILED" });
  }));
}
test("process double: private files, immutable snapshot and minimal environment", async () => {
  const key = "PDF_ADAPTER_SYNTHETIC_SECRET"; const old = process.env[key]; process.env[key] = "synthetic";
  try {
    await processCase("process.exit(process.argv.includes('--is-encrypted')?2:0);", async (adapter, _root, trace) => {
      const bytes = pdf(); const expected = sha256(bytes); const pending = adapter.validate(bytes, { signal: signal() }); bytes.fill(0);
      const result = await pending; assert.equal(result.kind, "VALID");
      if (result.kind === "VALID") assert.equal(result.identity.sha256, expected);
      const entries = (await readFile(trace, "utf8")).trim().split("\n").map(line => JSON.parse(line) as { hash: string; mode: number; dirMode: number; secretPresent: boolean });
      assert.equal(entries.length, 2);
      for (const entry of entries) { assert.equal(entry.hash, expected); assert.equal(entry.mode, 0o600); assert.equal(entry.dirMode, 0o700); assert.equal(entry.secretPresent, false); }
    });
  } finally { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
});
test("process double: output budget spans both inspections and both streams", async () => {
  await processCase("if(process.argv.includes('--is-encrypted')){process.stdout.write(Buffer.alloc(40000),()=>process.exit(2));}else{process.stderr.write(Buffer.alloc(30000));setInterval(()=>{},1000);}", async adapter => {
    assert.deepEqual(await adapter.validate(pdf(), { signal: signal() }), { kind: "FAILED" });
  });
});
test("missing executable and bounded input fail without creating temporary input", async () => {
  const adapter = createQpdfValidationPort({ executablePath: "/nonexistent/passvero-qpdf" });
  assert.deepEqual(await adapter.validate(pdf(), { signal: signal() }), { kind: "FAILED" });
  for (const bytes of [new Uint8Array(), new Uint8Array(10485761)]) {
    assert.deepEqual(await adapter.validate(bytes, { signal: signal() }), { kind: "INVALID", reason: "STRUCTURE" });
  }
});

test("unusable executable is an operational failure and cleans private storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "qpdf-unusable-test-"));
  try {
    const executable = join(root, "not-executable"); await writeFile(executable, "synthetic", { mode: 0o600 });
    const temporaryRoot = join(root, "validation"); await mkdir(temporaryRoot);
    const adapter = createQpdfValidationPort({ executablePath: executable, temporaryRoot });
    assert.deepEqual(await adapter.validate(pdf(), { signal: signal() }), { kind: "FAILED" });
    assert.deepEqual(await readdir(temporaryRoot), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
