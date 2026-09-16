import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAcceptanceReceiptWriter } from "../../src/infrastructure/documents/acceptance-receipt-journal";
import type { AcceptanceManifest } from "../../src/application/documents/acceptance-cleanup";
test("receipt is exclusive, private and contains no PDF bytes; insecure directory rejects", async () => {
  const dir = await mkdtemp(join(tmpdir(), "receipt-"));
  try {
    // Resolve macOS /var -> /private/var once, as trusted operator configuration.
    const { realpath } = await import("node:fs/promises"); const root = await realpath(dir);
    const manifest: AcceptanceManifest = { version: 1, environment: "staging", runId: randomUUID(), actorId: randomUUID(), organizationId: randomUUID(), entries: [{ documentId: randomUUID(), storageKey: `documents/${randomUUID()}.pdf`, sizeBytes: 1, checksumSha256: "a".repeat(64) }] };
    const write = createAcceptanceReceiptWriter(root);
    await write(manifest, "b".repeat(64));
    const before = await readFile(join(root, manifest.entries[0].documentId + ".json"));
    await assert.rejects(write(manifest, "c".repeat(64)));
    assert.deepEqual(await readFile(join(root, manifest.entries[0].documentId + ".json")), before);
    await chmod(root, 0o755); await assert.rejects(write(manifest, "b".repeat(64)), /FORBIDDEN/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
