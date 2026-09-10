import assert from "node:assert/strict";
import test from "node:test";
import { createDraftFromPublishedService } from "../../src/application/products/create-draft-from-published/service";
import type { CreateDraftFromPublishedPersistence } from "../../src/application/products/create-draft-from-published/ports";
import { DraftCreationConflict } from "../../src/application/products/create-draft-from-published/ports";
import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
const productId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const draftId = "33333333-3333-4333-8333-333333333333";
const at = new Date("2026-09-10T12:00:00.000Z");
const context: AuthenticatedUserContext = { userId: "actor", organizationId: "org", membershipId: "member", membershipRole: "ADMIN", membershipStatus: "ACTIVE", permissions: ["PRODUCT_EDIT"], correlationId: "clone-test" };
const command = { productId, expectedCurrentPublishedVersionId: sourceId, expectedProductUpdatedAt: at.toISOString() };
function harness() {
  const product = { productId, organizationId: "org", lifecycleStatus: "ACTIVE" as "ACTIVE" | "ARCHIVED", publicCode: "AbCdEfGhIjKlMnOpQrStUv", currentDraftVersionId: null as string | null, currentPublishedVersionId: sourceId as string | null, updatedAt: at };
  const version = { productVersionId: sourceId, productId, organizationId: "org", status: "PUBLISHED" as const, sourceLocale: "hr", versionNumber: 1, updatedAt: at, reviewReadyAt: null, publishedAt: at, publishedById: "actor", supersededAt: null, discardedAt: null, clonedFromVersionId: null as string | null };
  const copy = { imageCount: 0, sourceTranslationValid: true, documentOwnershipValid: true };
  let writes = 0;
  const persistence: CreateDraftFromPublishedPersistence<null> = {
    readEligibility: async () => ({ organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "ADMIN" }),
    readProductForPublication: async () => product,
    readVersion: async (_, input) => input.productVersionId === sourceId ? version : { ...version, productVersionId: draftId, status: "DRAFT", versionNumber: null, publishedAt: null, publishedById: null, clonedFromVersionId: sourceId },
    readCopyEligibility: async () => copy,
    createDraft: async (_, input) => { assert.equal(input.sourceVersionId, sourceId); assert.equal(input.actorId, context.userId); writes++; },
  };
  return { product, version, copy, persistence, writes: () => writes, run: (cmd = command, ctx: AuthenticatedUserContext | null = context) => createDraftFromPublishedService({ transactionRunner: { run: work => work(null) }, persistence })(cmd, ctx) };
}
const code = (expected: string) => (error: unknown) => error instanceof ApplicationError && error.code === expected;
test("image-free published Product creates one private draft from trusted authority", async () => {
  const f = harness(); assert.deepEqual(await f.run(), { status: "CREATED_NEW_DRAFT" }); assert.equal(f.writes(), 1);
});
for (const imageCount of [1, 2]) test(`${imageCount} published images reject before any business write`, async () => {
  const f = harness(); f.copy.imageCount = imageCount;
  await assert.rejects(f.run(), code("CREATE_DRAFT_IMAGES_UNSUPPORTED")); assert.equal(f.writes(), 0);
});
test("compatible repeated request resumes existing draft even with old product timestamp", async () => {
  const f = harness(); f.product.currentDraftVersionId = draftId; f.product.updatedAt = new Date(at.getTime() + 1);
  assert.deepEqual(await f.run(), { status: "EXISTING_DRAFT" }); assert.equal(f.writes(), 0);
});
for (const scenario of ["viewer", "anonymous", "revoked", "archived", "foreign", "missing", "pointer", "source", "documents", "stale", "new-publication", "unrelated-draft"] as const) test(`${scenario} cannot write a draft`, async () => {
  const f = harness(); let ctx: AuthenticatedUserContext | null = context;
  if (scenario === "viewer") ctx = { ...context, permissions: ["PRODUCT_READ"], membershipRole: "VIEWER" };
  if (scenario === "anonymous") ctx = null;
  if (scenario === "revoked") f.persistence.readEligibility = async () => null;
  if (scenario === "archived") f.product.lifecycleStatus = "ARCHIVED";
  if (scenario === "foreign") f.product.organizationId = "other";
  if (scenario === "missing") f.persistence.readProductForPublication = async () => null;
  if (scenario === "pointer") f.version.productId = "other";
  if (scenario === "source") f.copy.sourceTranslationValid = false;
  if (scenario === "documents") f.copy.documentOwnershipValid = false;
  if (scenario === "stale") f.product.updatedAt = new Date(at.getTime() + 1);
  if (scenario === "new-publication") f.product.currentPublishedVersionId = draftId;
  if (scenario === "unrelated-draft") { f.product.currentDraftVersionId = draftId; const read = f.persistence.readVersion; f.persistence.readVersion = async (tx, input) => { const row = await read(tx, input); return row && { ...row, clonedFromVersionId: null }; }; }
  await assert.rejects(f.run(command, ctx), error => error instanceof ApplicationError); assert.equal(f.writes(), 0);
});
test("normalizes database conflict without raw uniqueness details", async () => {
  const f = harness(); f.persistence.createDraft = async () => { throw new DraftCreationConflict("private SQL"); };
  await assert.rejects(f.run(), code("CREATE_DRAFT_CONFLICT"));
});
test("rejects untrusted extra fields and malformed evidence", async () => {
  for (const cmd of [{ ...command, productId: "bad" }, { ...command, versionNumber: 2 }, { ...command, expectedProductUpdatedAt: "2026-09-10" }]) {
    const f = harness(); await assert.rejects(f.run(cmd), code("CREATE_DRAFT_VALIDATION_ERROR")); assert.equal(f.writes(), 0);
  }
});

for (const status of ["DRAFT", "READY_FOR_REVIEW", "SUPERSEDED", "DISCARDED"] as const) test(`published pointer with ${status} status fails before writes`, async () => {
  const f = harness(); f.persistence.readVersion = async () => ({ ...f.version, status });
  await assert.rejects(f.run(), code("CREATE_DRAFT_INVALID_STATE")); assert.equal(f.writes(), 0);
});
for (const mutation of ["missing-version", "foreign-version-org", "unsupported-locale", "invalid-number", "missing-publication"] as const) test(`${mutation} cannot serve as clone source`, async () => {
  const f = harness();
  f.persistence.readVersion = async () => mutation === "missing-version" ? null : ({ ...f.version,
    organizationId: mutation === "foreign-version-org" ? "foreign" : "org",
    sourceLocale: mutation === "unsupported-locale" ? "xx" : "hr",
    versionNumber: mutation === "invalid-number" ? 0 : 1,
    publishedAt: mutation === "missing-publication" ? null : at,
  });
  await assert.rejects(f.run(), code("CREATE_DRAFT_INVALID_STATE")); assert.equal(f.writes(), 0);
});
