import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQpdfBrokerPort } from "../../src/infrastructure/documents/qpdf-broker-client";
import { sha256 } from "../../src/application/documents/pdf";

test("byte-only fixed frame, snapshot identity, no caller path or arguments", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pv-broker-"));
  const path = join(dir, "socket"); const bytes = Buffer.from("synthetic");
  const server = createServer(socket => {
    let buffer = Buffer.alloc(0);
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 8 + bytes.length) return;
      assert.equal(buffer.subarray(0, 4).toString(), "PVQ1");
      assert.equal(buffer.readUInt32BE(4), bytes.length);
      assert.deepEqual(buffer.subarray(8), bytes);
      socket.end(JSON.stringify({ kind: "VALID", identity: { sizeBytes: bytes.length, sha256: sha256(bytes) } }));
    });
  });
  await new Promise<void>(resolve => server.listen(path, resolve));
  try { assert.equal((await createQpdfBrokerPort(path).validate(bytes, { signal: new AbortController().signal })).kind, "VALID"); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true }); }
});
test("abort is transmitted; result waits for broker close after cleanup acknowledgement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pv-broker-")); const path = join(dir, "s");
  const controller = new AbortController(); let cleaned = false;
  const server = createServer(socket => {
    let received = 0;
    socket.on("data", chunk => {
      received += chunk.length;
      if (received === 9) controller.abort();
      if (received > 9) setTimeout(() => { cleaned = true; socket.end('{"kind":"FAILED"}'); }, 20);
    });
  });
  await new Promise<void>(resolve => server.listen(path, resolve));
  try {
    assert.equal((await createQpdfBrokerPort(path).validate(Buffer.from("a"), { signal: controller.signal })).kind, "FAILED");
    assert.equal(cleaned, true);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true }); }
});
