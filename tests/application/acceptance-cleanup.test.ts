import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { createAcceptanceCleanup, sealAcceptanceManifest, type AcceptanceManifest } from "../../src/application/documents/acceptance-cleanup";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
const context: AuthenticatedUserContext = { userId: randomUUID(), organizationId: randomUUID(), membershipId: randomUUID(), membershipStatus: "ACTIVE", membershipRole: "EDITOR", permissions: ["PRODUCT_EDIT"], correlationId: randomUUID() };
const key = randomBytes(32);
const manifest: AcceptanceManifest = { version: 1, environment: "staging", runId: randomUUID(), actorId: context.userId, organizationId: context.organizationId, entries: [{ documentId: randomUUID(), storageKey: `documents/${randomUUID()}.pdf`, sizeBytes: 1, checksumSha256: "a".repeat(64) }] };
test("seal, tenant and permission failures perform no cleanup", async () => {
  const cleanup = createAcceptanceCleanup({ key, persistence: { async archive() { assert.fail(); } }, async remove() { assert.fail(); } });
  for (const [input, seal, actor] of [
    [manifest, "0".repeat(64), context],
    [manifest, sealAcceptanceManifest(manifest, key), { ...context, permissions: [] }],
    [manifest, sealAcceptanceManifest(manifest, key), { ...context, organizationId: randomUUID() }],
    [{ ...manifest, runId: randomUUID() }, sealAcceptanceManifest(manifest, key), context],
  ] as const) await assert.rejects(cleanup(input, seal, actor), /FORBIDDEN/);
});
test("archive commits before storage, partial failure remains retryable", async () => {
  let archived = false; let failure = true;
  const cleanup = createAcceptanceCleanup({ key, persistence: { async archive() { archived = true; } }, async remove() { assert.ok(archived); if (failure) throw new Error(); } });
  assert.equal((await cleanup(manifest, sealAcceptanceManifest(manifest, key), context)).result, "PARTIAL");
  assert.ok(archived); failure = false;
  for (let n = 0; n < 2; n++) assert.equal((await cleanup(manifest, sealAcceptanceManifest(manifest, key), context)).result, "PASS");
});
test("database failure cannot remove an object", async () => {
  const cleanup = createAcceptanceCleanup({ key, persistence: { async archive() { throw new Error(); } }, async remove() { assert.fail(); } });
  assert.equal((await cleanup(manifest, sealAcceptanceManifest(manifest, key), context)).result, "PARTIAL");
});
