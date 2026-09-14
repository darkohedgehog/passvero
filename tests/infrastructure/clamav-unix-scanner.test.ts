import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ClamavUnixScanner } from "../../src/infrastructure/documents/clamav-unix-scanner";
async function fixture(handler: (socket: Socket) => void) {
  const dir = await mkdtemp(join(tmpdir(), "pv-clam-")); const path = join(dir, "s");
  const peers = new Set<Socket>();
  const server = createServer(socket => { peers.add(socket); socket.on("error", () => {}); socket.on("close", () => peers.delete(socket)); handler(socket); });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(path, resolve); });
  return { path, adapter: new ClamavUnixScanner(path, new Set(["Win.Test.Malware-1", "Eicar-Signature"])), async close() { for (const s of peers) s.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true }); } };
}
function framing(socket: Socket, reply: () => void) {
  let wire = Buffer.alloc(0); let command = false; const chunks: Buffer[] = [];
  socket.on("data", data => {
    wire = Buffer.concat([wire, data]);
    if (!command) { if (wire.length < 10) return; assert.equal(wire.subarray(0, 10).toString(), "zINSTREAM\0"); wire = wire.subarray(10); command = true; }
    while (wire.length >= 4) {
      const size = wire.readUInt32BE(0); assert.ok(size <= 65536);
      if (wire.length < 4 + size) return;
      if (!size) { wire = wire.subarray(4); assert.equal(wire.length, 0); reply(); return; }
      chunks.push(Buffer.from(wire.subarray(4, 4 + size))); wire = wire.subarray(4 + size);
    }
  });
  return chunks;
}
test("bounded INSTREAM exact bytes with backpressure and fragmented response", async () => {
  const input = Buffer.alloc(10_485_760, 42); let chunks: Buffer[] = [];
  const f = await fixture(socket => { socket.pause(); setTimeout(() => socket.resume(), 10); chunks = framing(socket, () => { socket.write("stre"); setImmediate(() => { socket.write("am: O"); setImmediate(() => socket.end("K\0")); }); }); });
  try { assert.equal((await f.adapter.scan(input, { signal: new AbortController().signal })).kind, "OK"); assert.deepEqual(Buffer.concat(chunks), input); }
  finally { await f.close(); }
});
for (const [reply, expected] of [
  ["stream: Eicar-Signature FOUND\0", "MALWARE_DETECTED"], ["stream: Win.Test.Malware-1 FOUND\0", "MALWARE_DETECTED"],
  ["stream: Unknown.Signature FOUND\0", "INVALID_RESPONSE"], ["stream: Heuristics.Limits.Exceeded.MaxScanSize FOUND\0", "INCOMPLETE"],
  ["stream: Heuristics.Encrypted.PDF FOUND\0", "INCOMPLETE"], ["INSTREAM size limit exceeded. ERROR\0", "INCOMPLETE"],
  ["stream: OK\0stream: Eicar-Signature FOUND\0", "INVALID_RESPONSE"], ["stream: OK", "INVALID_RESPONSE"],
  ["stream: OK\n\0", "INVALID_RESPONSE"], ["x".repeat(4097), "INVALID_RESPONSE"], ["", "INVALID_RESPONSE"],
] as const) {
  test(`response ${expected}: ${reply.slice(0, 45).replaceAll("\0", "|")}`, async () => {
    const f = await fixture(socket => framing(socket, () => socket.end(reply)));
    try { assert.equal((await f.adapter.scan(Buffer.from("test"), { signal: new AbortController().signal })).kind, expected); }
    finally { await f.close(); }
  });
}
test("contradictory trailing frame in another packet rejects initial OK", async () => {
  const f = await fixture(socket => framing(socket, () => { socket.write("stream: OK\0"); setImmediate(() => socket.end("stream: bad FOUND\0")); }));
  try { assert.equal((await f.adapter.scan(Buffer.from("x"), { signal: new AbortController().signal })).kind, "INVALID_RESPONSE"); }
  finally { await f.close(); }
});
test("unavailable, input boundaries and invalid socket configuration", async () => {
  assert.throws(() => new ClamavUnixScanner("tcp:3310", new Set()));
  const f = await fixture(s => s.destroy()); await f.close();
  const signal = new AbortController().signal;
  assert.equal((await f.adapter.scan(Buffer.from("x"), { signal })).kind, "UNAVAILABLE");
  for (const input of [Buffer.alloc(0), Buffer.alloc(10_485_761)]) assert.equal((await f.adapter.scan(input, { signal })).kind, "INCOMPLETE");
});
test("cancellation releases slot and sockets, busy invocation is not queued", async () => {
  const f = await fixture(socket => framing(socket, () => {})); const c = new AbortController();
  try {
    const first = f.adapter.scan(Buffer.from("x"), { signal: c.signal });
    assert.equal((await f.adapter.scan(Buffer.from("x"), { signal: new AbortController().signal })).kind, "NOT_READY");
    c.abort(); assert.equal((await first).kind, "INTERRUPTED");
    const next = new AbortController(); const second = f.adapter.scan(Buffer.from("x"), { signal: next.signal }); next.abort(); assert.equal((await second).kind, "INTERRUPTED");
  } finally { await f.close(); }
});
test("2s connection deadline and 30s overall deadline clean up", async t => {
  let connected!: () => void; const connection = new Promise<void>(resolve => { connected = resolve; });
  const f = await fixture(s => framing(s, connected));
  try {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const first = f.adapter.scan(Buffer.from("x"), { signal: new AbortController().signal });
    t.mock.timers.tick(2000); assert.equal((await first).kind, "TIMEOUT");
    const second = f.adapter.scan(Buffer.from("x"), { signal: new AbortController().signal });
    await connection; t.mock.timers.tick(30_000); assert.equal((await second).kind, "TIMEOUT");
  } finally { t.mock.timers.reset(); await f.close(); }
});
