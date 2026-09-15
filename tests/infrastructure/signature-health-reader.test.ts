import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createPrivateHealthSnapshotReader, createSignatureHealthProvider, type PrivateHealthSnapshotReader } from "../../src/infrastructure/documents/signature-health-reader";
const now = 2_000_000_000;
const socketPath = "/run/clamav/clamd.ctl";
const provenance = { scanner: "clamav", engineVersion: "1", signatureVersion: "1", databaseIdentity: "verified-generation-1", daemonIdentity: "load-epoch-1" };
function snapshot() {
  return { schemaVersion: 1, socketPath, capturedAt: now - 1, expiresAt: now + 1000,
    evidence: { lastSuccessfulVerifiedCheckAt: now - 100, checkResult: "ALREADY_CURRENT", databasesValidated: true, unresolvedError: false, validated: { ...provenance }, loaded: { ...provenance } } };
}
const config = { path: "/var/lib/passvero/health.json", socketPath };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
function provider(value: unknown) {
  return createSignatureHealthProvider(config, { async read(path, options) { assert.equal(path, config.path); assert.equal(options.limit, 16384); return encode(value); } }, () => now);
}
const options = () => ({ signal: new AbortController().signal });
test("complete verified already-current evidence is returned without fabricated timestamps", async () => {
  const source = snapshot(); assert.deepEqual(await provider(source).read(options()), source.evidence);
  assert.deepEqual(await provider({ ...source, evidence: { ...source.evidence, checkResult: "UPDATED" } }).read(options()), { ...source.evidence, checkResult: "UPDATED" });
});
test("strict 24h freshness plus producer validity window", async () => {
  const source = snapshot();
  assert.ok(await provider({ ...source, capturedAt: now, expiresAt: now + 1, evidence: { ...source.evidence, lastSuccessfulVerifiedCheckAt: now - 86_399_999 } }).read(options()));
  for (const patch of [
    { capturedAt: now + 1 }, { capturedAt: now - 101 }, { expiresAt: now },
    { expiresAt: now + 86_400_000 },
    { evidence: { ...source.evidence, lastSuccessfulVerifiedCheckAt: now - 86_400_000 } },
    { evidence: { ...source.evidence, lastSuccessfulVerifiedCheckAt: now + 1 } },
  ]) assert.equal(await provider({ ...source, ...patch }).read(options()), null);
});
test("reject missing, incomplete, mismatched, failed, unresolved and unknown evidence", async () => {
  const source = snapshot();
  for (const value of [null, {}, { ...source, schemaVersion: 2 }, { ...source, extra: true }, { ...source, socketPath: "/run/other.sock" },
    { ...source, evidence: { ...source.evidence, extra: true } },
    { ...source, evidence: { ...source.evidence, unresolvedError: true } },
    { ...source, evidence: { ...source.evidence, databasesValidated: false } },
    { ...source, evidence: { ...source.evidence, checkResult: "FAILED" } },
    { ...source, evidence: { ...source.evidence, loaded: { ...provenance, daemonIdentity: "other" } } },
    { ...source, evidence: { ...source.evidence, validated: {} } },
    { ...source, capturedAt: "2026-09-15" },
  ]) assert.equal(await provider(value).read(options()), null);
});
test("malformed, duplicate keys, invalid UTF-8, oversized and private errors are sanitized", async () => {
  for (const bytes of [Buffer.from("{"), Buffer.alloc(16385, 120), Buffer.from([255]), Buffer.from('{"schemaVersion":2,' + JSON.stringify(snapshot()).slice(1))]) {
    const p = createSignatureHealthProvider(config, { async read() { return bytes; } }, () => now);
    assert.equal(await p.read(options()), null);
  }
  assert.equal(await createSignatureHealthProvider(config, { async read() { throw new Error("private filesystem path diagnostic"); } }).read(options()), null);
});
test("deadline, cancellation and one outstanding read; no accumulating timed-out reads", async t => {
  let release!: (bytes: Uint8Array) => void; let calls = 0; let signal: AbortSignal | undefined;
  const reader: PrivateHealthSnapshotReader = { read(_p, o) { calls++; signal = o.signal; return new Promise(resolve => { release = resolve; }); } };
  const p = createSignatureHealthProvider(config, reader, () => now);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const pending = p.read(options()); await Promise.resolve();
    assert.equal(await p.read(options()), null); assert.equal(calls, 1);
    t.mock.timers.tick(2000); assert.equal(await pending, null); assert.equal(signal?.aborted, true);
    assert.equal(await p.read(options()), null); assert.equal(calls, 1);
    release(encode(snapshot())); await new Promise<void>(resolve => setImmediate(resolve));
    const c = new AbortController(); const next = p.read({ signal: c.signal }); await Promise.resolve(); c.abort(); assert.equal(await next, null);
    release(encode(snapshot()));
  } finally { t.mock.timers.reset(); }
});
test("private regular local file: bounded read, mode/owner checks, symlink and cancellation denial", async () => {
  const directory = await mkdtemp(join(process.cwd(), "health-fixture-"));
  const path = join(directory, "snapshot.json");
  const reader = createPrivateHealthSnapshotReader(process.getuid!());
  const source = encode(snapshot());
  try {
    await writeFile(path, source, { mode: 0o600 });
    assert.deepEqual(await reader.read(path, { ...options(), limit: 16384 }), source);
    if (process.getuid!() !== 0) await assert.rejects(createPrivateHealthSnapshotReader().read(path, { ...options(), limit: 16384 }), /HEALTH_UNAVAILABLE/);
    await chmod(directory, 0o777); await assert.rejects(reader.read(path, { ...options(), limit: 16384 })); await chmod(directory, 0o700);
    await chmod(path, 0o666); await assert.rejects(reader.read(path, { ...options(), limit: 16384 })); await chmod(path, 0o600);
    await symlink(path, join(directory, "link.json")); await assert.rejects(reader.read(join(directory, "link.json"), { ...options(), limit: 16384 }));
    await writeFile(path, Buffer.alloc(16385)); await assert.rejects(reader.read(path, { ...options(), limit: 16384 }));
    const c = new AbortController(); c.abort(); await assert.rejects(reader.read(path, { signal: c.signal, limit: 16384 }));
    assert.equal((await readFile(path)).length, 16385);
  } finally { await rm(directory, { recursive: true }); }
});
test("replaced snapshot during read is rejected instead of mixing generations", async t => {
  const fs = await import("node:fs/promises");
  const directory = await mkdtemp(join(process.cwd(), "health-fixture-"));
  const path = join(directory, "snapshot.json");
  const originalOpen = fs.open;
  try {
    await writeFile(path, encode(snapshot()), { mode: 0o600 });
    // Intercept only the file handle's second stat, after bytes have been read.
    t.mock.method(fs.default, "open", async (...args: Parameters<typeof originalOpen>) => {
      const handle = await originalOpen(...args);
      const stat = handle.stat.bind(handle); let calls = 0;
      t.mock.method(handle, "stat", async () => {
        const result = await stat();
        if (++calls === 2) { await writeFile(path + ".new", encode(snapshot()), { mode: 0o600 }); await fs.rename(path + ".new", path); }
        return result;
      });
      return handle;
    });
    await assert.rejects(createPrivateHealthSnapshotReader(process.getuid!()).read(path, { ...options(), limit: 16384 }), /HEALTH_UNAVAILABLE/);
  } finally { t.mock.restoreAll(); await rm(directory, { recursive: true }); }
});
