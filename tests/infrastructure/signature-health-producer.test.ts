import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createSignatureHealthProducer, type ProducerIO, type ProducerObservation } from "../../src/infrastructure/documents/signature-health-producer";
import { createProducerIO, readDaemonVersion } from "../../src/infrastructure/documents/signature-health-producer-io";
import { createPrivateHealthSnapshotReader, createSignatureHealthProvider } from "../../src/infrastructure/documents/signature-health-reader";
import { parseFreshclamEvidence, parseDaemonVersion } from "../../src/infrastructure/documents/freshclam-evidence";
import { healthFixture } from "../helpers/signature-health-fixture";
const now = Date.UTC(2026, 8, 14, 16, 5, 0);
const stamp = "Mon Sep 14 16:04:00 2026";
const prefix = `${stamp} -> `;
const names = ["main", "daily", "bytecode"] as const;
const versions = [63, 28123, 339];
// SYNTHETIC transcript using upstream 1.5.3 format strings. Not captured staging evidence.
function cycle(current = false) {
  return [prefix + `ClamAV update process started at ${stamp}`,
    ...names.map((name, i) => prefix + `${name}.cvd ${current ? "database is up-to-date" : "updated"} (version: ${versions[i]}, sigs: 1, f-level: 90, builder: synthetic)`),
    prefix + "--------------------------------------", ""].join("\n");
}
function fixture() {
  let sequence = 0; let locked = false; let invalidations = 0; let published: Uint8Array | undefined;
  let observation: ProducerObservation = { updaterLog: cycle(), daemonLog: "Loaded 3 signatures.", components: healthFixture(now).disk.components, sourceIdentity: "synthetic" };
  const io: ProducerIO = {
    async acquire() { if (locked) return false; locked = true; return true; }, async release() { locked = false; },
    async nextSequence() { return ++sequence; }, async collect() { return structuredClone(observation); },
    async version() { return `ClamAV 1.5.3/28123/${stamp}\0`; },
    async publish(bytes) { published = bytes; }, async invalidate() { invalidations++; published = undefined; },
  };
  return { io, set: (next: ProducerObservation) => { observation = next; }, observation,
    run: createSignatureHealthProducer("/run/clamav/clamd.ctl", io, { now: () => now, monotonic: () => 0 }),
    bytes: () => published, invalidations: () => invalidations };
}
async function settle() { await new Promise<void>(resolve => setImmediate(resolve)); }
test("healthy UPDATED and verified ALREADY_CURRENT reach actual reader; timestamp comes from completed cycle", async () => {
  const f = fixture();
  for (const current of [false, true]) {
    f.set({ ...f.observation, updaterLog: cycle() + (current ? cycle(true) : "") });
    assert.equal(await f.run(), "PUBLISHED"); await settle();
    const reader = createSignatureHealthProvider({ path: "/private/snapshot", socketPath: "/run/clamav/clamd.ctl" }, { async read() { return f.bytes()!; } }, () => now);
    const value = await reader.read({ signal: new AbortController().signal });
    assert.ok(value); const snapshot = JSON.parse(Buffer.from(f.bytes()!).toString());
    assert.equal(snapshot.evidence.updater.completedAt, now - 60_000);
    assert.equal(snapshot.evidence.updater.result, current ? "ALREADY_CURRENT" : "UPDATED");
  }
  assert.throws(() => parseFreshclamEvidence(cycle(true), f.observation.components, now));
});
test("future/expired, missing, partial and unsupported evidence never publishes healthy", async () => {
  const f = fixture();
  for (const log of ["", cycle().slice(0, -1), cycle().replace("--------------------------------------", "WARNING: secret-path"), cycle().replace("ClamAV update process started", "unknown"), "x".repeat(1_048_577)]) {
    f.set({ ...f.observation, updaterLog: log }); assert.equal(await f.run(), "UNTRUSTED"); await settle(); assert.equal(f.bytes(), undefined);
  }
  assert.throws(() => parseFreshclamEvidence(cycle(), f.observation.components, now - 60_001));
  assert.throws(() => parseFreshclamEvidence(cycle(), f.observation.components, now - 60_000 + 86_400_000));
});
test("failed updater or later validation/reload error invalidates without renewing timestamp or leaking raw text", async () => {
  const f = fixture(); assert.equal(await f.run(), "PUBLISHED"); await settle();
  f.set({ ...f.observation, updaterLog: cycle() + prefix + "ERROR: SECRET_SENTINEL\n" });
  assert.equal(await f.run(), "UNTRUSTED"); await settle(); assert.equal(f.bytes(), undefined);
  f.set({ ...f.observation, daemonLog: "WARNING: reload failed SECRET_SENTINEL" });
  assert.equal(await f.run(), "UNTRUSTED"); await settle(); assert.equal(f.invalidations(), 2);
});
test("observed mismatch/change and malformed/unavailable daemon rejected", async () => {
  for (const reply of ["PONG\0", `ClamAV 1.5.3/2/${stamp}\0`, `ClamAV 1.5.3/28123/${stamp}\0trailing`]) {
    const f = fixture(); f.io.version = async () => reply; assert.equal(await f.run(), "UNTRUSTED"); await settle();
  }
  const f = fixture(); let calls = 0;
  f.io.collect = async () => ({ ...f.observation, sourceIdentity: String(++calls) });
  assert.equal(await f.run(), "UNTRUSTED"); await settle();
  f.io.version = async () => { throw new Error("private socket"); };
  assert.equal(await f.run(), "UNTRUSTED");
  assert.throws(() => parseDaemonVersion("x".repeat(4097)));
});
test("five seconds includes collection and validation; stalled collector cannot publish later or overlap", async t => {
  const f = fixture(); let release!: (o: ProducerObservation) => void;
  f.io.collect = () => new Promise(resolve => { release = resolve; });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const pending = f.run(); for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(await f.run(), "BUSY"); t.mock.timers.tick(5000);
    assert.equal(await pending, "UNTRUSTED"); assert.equal(await f.run(), "BUSY");
    release(f.observation); await settle(); assert.equal(f.bytes(), undefined);
  } finally { t.mock.timers.reset(); }
  let monotonic = 0; const g = fixture();
  g.io.version = async () => { monotonic = 5000; return `ClamAV 1.5.3/28123/${stamp}\0`; };
  assert.equal(await createSignatureHealthProducer("/run/clamav/clamd.ctl", g.io, { now: () => now, monotonic: () => monotonic })(), "UNTRUSTED");
});
test("publication/invalidation failure explicit; no HEALTHY success on failed rename", async () => {
  const f = fixture(); f.io.publish = async () => { throw new Error("private path"); };
  assert.equal(await f.run(), "OPERATIONAL_FAILURE"); await settle(); assert.equal(f.bytes(), undefined);
  f.io.collect = async () => { throw new Error(); }; f.io.invalidate = async () => { throw new Error(); };
  assert.equal(await f.run(), "OPERATIONAL_FAILURE");
});
test("real atomic filesystem publication and lock; actual protected reader; stale sequence rejected", async () => {
  const directory = await mkdtemp(join(process.cwd(), "producer-fixture-"));
  try {
    const outputPath = join(directory, "health.json");
    const config = { socketPath: "/run/clamav/clamd.ctl", outputPath, updaterLog: join(directory, "updater.log"), daemonLog: join(directory, "daemon.log"), databaseDirectory: join(directory, "db"), updaterConfig: join(directory, "freshclam.conf"), updaterConfigSha256: "a".repeat(64), scannerUid: 999, outputGid: process.getgid!() };
    const io = createProducerIO(config, process.getuid!()); const other = createProducerIO(config, process.getuid!());
    const f = fixture(); io.collect = f.io.collect; io.version = f.io.version;
    assert.equal(await io.acquire(), true); assert.equal(await other.acquire(), false); await io.release();
    const run = createSignatureHealthProducer(config.socketPath, io, { now: () => now, monotonic: () => 0 });
    assert.equal(await run(), "PUBLISHED"); await settle();
    const older = await readFile(outputPath);
    const reader = createSignatureHealthProvider({ path: outputPath, socketPath: config.socketPath }, createPrivateHealthSnapshotReader(process.getuid!()), () => now);
    assert.ok(await reader.read({ signal: new AbortController().signal }));
    assert.equal(await run(), "PUBLISHED"); await settle(); assert.ok(await reader.read({ signal: new AbortController().signal }));
    await writeFile(outputPath, older); assert.equal(await reader.read({ signal: new AbortController().signal }), null);
    await io.invalidate(); assert.equal(await reader.read({ signal: new AbortController().signal }), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("Unix client bounded fake communication only; no live socket", async () => {
  // Aborted-before-connect must not open even the deliberately nonexistent endpoint.
  const c = new AbortController(); c.abort(); await assert.rejects(readDaemonVersion("/nonexistent/synthetic.sock", c.signal), /DAEMON_UNAVAILABLE/);
});

test("bounded source capture uses configured files and hashes actual synthetic database bytes", async () => {
  const fs = await import("node:fs/promises"); const { createHash } = await import("node:crypto");
  const directory = await mkdtemp(join(process.cwd(), "producer-fixture-"));
  try {
    const db = join(directory, "db"); await fs.mkdir(db, { mode: 0o700 });
    const configText = "TestDatabases yes\n";
    const config = { socketPath: "/run/clamav/clamd.ctl", outputPath: join(directory, "out"), updaterLog: join(directory, "u"), daemonLog: join(directory, "d"), databaseDirectory: db, updaterConfig: join(directory, "c"), updaterConfigSha256: createHash("sha256").update(configText).digest("hex"), scannerUid: 999, outputGid: process.getgid!() };
    await writeFile(config.updaterConfig, configText, { mode: 0o600 });
    await writeFile(config.updaterLog, cycle(), { mode: 0o600 });
    await writeFile(config.daemonLog, "Loaded 3 signatures.\n", { mode: 0o600 });
    for (let i = 0; i < names.length; i++) {
      const payload = Buffer.from("SYNTHETIC-NOT-A-SIGNED-DATABASE");
      const header = `ClamAV-VDB:synthetic:${versions[i]}:1:90:${createHash("md5").update(payload).digest("hex")}:synthetic:synthetic:0`;
      const bytes = Buffer.concat([Buffer.from(header.padEnd(512, " ")), payload]);
      await writeFile(join(db, `${names[i]}.cvd`), bytes, { mode: 0o600 });
      await writeFile(join(db, `${names[i]}-${versions[i]}.cvd.sign`), "synthetic", { mode: 0o600 });
    }
    const io = createProducerIO(config, process.getuid!());
    const capture = await io.collect(new AbortController().signal);
    assert.equal(capture.components.length, 3);
    assert.equal(capture.components[0].sha256, createHash("sha256").update(await readFile(join(db, "main.cvd"))).digest("hex"));
    await fs.appendFile(join(db, "main.cvd"), "corruption");
    await assert.rejects(io.collect(new AbortController().signal), /DATABASE_INVALID/);
    // This verifies integrity plumbing only; it does not validate synthetic signatures.
  } finally { await rm(directory, { recursive: true, force: true }); }
});
