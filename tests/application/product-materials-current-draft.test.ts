import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import {
  normalizeAddProductMaterialCommand,
  normalizeEditProductMaterialCommand,
} from "../../src/application/products/product-materials-current-draft/normalize-command";
import type {
  ProductMaterialsCurrentDraftPersistence,
} from "../../src/application/products/product-materials-current-draft/ports";
import {
  createProductMaterialsCurrentDraftServices,
} from "../../src/application/products/product-materials-current-draft/services";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const materialId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const productUpdatedAt = new Date("2026-09-01T10:00:00.000Z");
const draftUpdatedAt = new Date("2026-09-01T10:01:00.000Z");
const materialUpdatedAt = new Date("2026-09-01T10:02:00.000Z");

const context: AuthenticatedUserContext = {
  userId,
  organizationId,
  membershipId,
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ", "PRODUCT_EDIT"],
  correlationId: "materials-correlation",
};

const values = {
  materialName: "  Reciklirani čelik 😀  ",
  category: "  Metal  ",
  percentage: "40.00",
  isRecycled: true,
  recycledPercentage: "75.00",
} as const;

const aggregateEvidence = {
  expectedDraftVersionId: draftId,
  expectedProductUpdatedAt: productUpdatedAt.toISOString(),
  expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
} as const;

test("normalizes the five editable fields without losing Unicode or case", () => {
  const normalized = normalizeAddProductMaterialCommand({
    productId,
    ...values,
    ...aggregateEvidence,
  }, context.correlationId);

  assert.deepEqual(normalized, {
    productId,
    materialName: "Reciklirani čelik 😀",
    category: "Metal",
    percentage: "40.00",
    isRecycled: true,
    recycledPercentage: "75.00",
    expectedDraftVersionId: draftId,
    expectedProductUpdatedAt: productUpdatedAt,
    expectedDraftUpdatedAt: draftUpdatedAt,
  });

  const optional = normalizeAddProductMaterialCommand({
    productId,
    ...values,
    category: "   ",
    percentage: null,
    isRecycled: false,
    recycledPercentage: null,
    ...aggregateEvidence,
  }, context.correlationId);
  assert.equal(optional.category, null);
  assert.equal(optional.percentage, null);
});

test("enforces Unicode lengths, exact decimal ranges, and recycled row semantics", () => {
  const command = { productId, ...values, ...aggregateEvidence };
  assert.equal(normalizeAddProductMaterialCommand({ ...command, materialName: "😀".repeat(200) }, "c").materialName, "😀".repeat(200));
  assert.equal(normalizeAddProductMaterialCommand({ ...command, category: "Ž".repeat(100) }, "c").category, "Ž".repeat(100));

  for (const invalid of [
    { materialName: "   " },
    { materialName: "😀".repeat(201) },
    { category: "a".repeat(101) },
    { percentage: "-0.01" },
    { percentage: "100.01" },
    { percentage: "1.001" },
    { percentage: 1 as never },
    { isRecycled: false, recycledPercentage: "0.00" },
  ]) {
    assert.throws(
      () => normalizeAddProductMaterialCommand({ ...command, ...invalid }, "c"),
      (error) => error instanceof ApplicationError && error.category === "VALIDATION",
    );
  }

  for (const valid of ["0", "0.00", "100", "100.00"] as const) {
    assert.equal(normalizeAddProductMaterialCommand({ ...command, percentage: valid }, "c").percentage, `${Number(valid).toFixed(2)}`);
    assert.equal(normalizeAddProductMaterialCommand({ ...command, recycledPercentage: valid }, "c").recycledPercentage, `${Number(valid).toFixed(2)}`);
  }

  assert.equal(normalizeAddProductMaterialCommand({ ...command, recycledPercentage: null }, "c").recycledPercentage, null);
  assert.equal(normalizeAddProductMaterialCommand({ ...command, percentage: "1.00", recycledPercentage: "99.00" }, "c").recycledPercentage, "99.00");
});

type Override = {
  eligibility?: null | Record<string, unknown>;
  product?: null | Record<string, unknown>;
  draft?: null | Record<string, unknown>;
  material?: null | Record<string, unknown>;
  materials?: readonly Record<string, unknown>[];
  cas?: "product" | "draft" | "material";
  loader?: null | Record<string, unknown>;
};

function fixture(overrides: Override = {}) {
  const transaction = Symbol("transaction");
  const calls: Array<{ name: string; input?: unknown }> = [];
  let committed = false;
  const currentMaterial = overrides.material === undefined ? {
    materialId,
    productVersionId: draftId,
    materialName: "Reciklirani čelik 😀",
    category: "Metal",
    percentage: "40.00",
    isRecycled: true,
    recycledPercentage: "75.00",
    createdAt: new Date("2026-09-01T09:00:00.000Z"),
    updatedAt: materialUpdatedAt,
  } : overrides.material;
  const materials = overrides.materials ?? (currentMaterial === null ? [] : [currentMaterial]);
  const persistence: ProductMaterialsCurrentDraftPersistence<typeof transaction> = {
    async findCurrentDraftByProductAndOrganization(input) {
      calls.push({ name: "loader", input });
      if (overrides.loader === null) return null;
      return (overrides.loader ?? {
        productId,
        organizationId,
        lifecycleStatus: "ACTIVE",
        currentDraftVersionId: draftId,
        updatedAt: productUpdatedAt,
        currentDraftVersion: {
          productVersionId: draftId,
          productId,
          organizationId,
          status: "DRAFT",
          updatedAt: draftUpdatedAt,
          materials,
        },
      }) as never;
    },
    async readEligibility(_tx, input) {
      calls.push({ name: "eligibility", input });
      return (overrides.eligibility === undefined
        ? { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "EDITOR" }
        : overrides.eligibility) as never;
    },
    async readProduct(_tx, input) {
      calls.push({ name: "product:read", input });
      return (overrides.product === undefined ? {
        productId,
        organizationId,
        lifecycleStatus: "ACTIVE",
        currentDraftVersionId: draftId,
        updatedAt: productUpdatedAt,
      } : overrides.product) as never;
    },
    async readDraftVersion(_tx, input) {
      calls.push({ name: "draft:read", input });
      return (overrides.draft === undefined ? {
        productVersionId: draftId,
        productId,
        organizationId,
        status: "DRAFT",
        updatedAt: draftUpdatedAt,
      } : overrides.draft) as never;
    },
    async readMaterial(_tx, input) { calls.push({ name: "material:read", input }); return currentMaterial as never; },
    async readMaterials(_tx, input) { calls.push({ name: "materials:read", input }); return materials as never; },
    async touchProductIfCurrent(_tx, input) { calls.push({ name: "product:cas", input }); return overrides.cas !== "product"; },
    async touchDraftVersionIfCurrent(_tx, input) { calls.push({ name: "draft:cas", input }); return overrides.cas !== "draft"; },
    async insertMaterial(_tx, input) { calls.push({ name: "material:insert", input }); return { materialId }; },
    async updateMaterialIfCurrent(_tx, input) { calls.push({ name: "material:update", input }); return overrides.cas !== "material"; },
    async deleteMaterialIfCurrent(_tx, input) { calls.push({ name: "material:delete", input }); return overrides.cas !== "material"; },
    async insertProductUpdatedAuditEvent(_tx, input) { calls.push({ name: "audit", input }); },
  };
  const services = createProductMaterialsCurrentDraftServices({
    transactionRunner: {
      async run(work) {
        calls.push({ name: "transaction:start" });
        const result = await work(transaction);
        committed = true;
        calls.push({ name: "transaction:commit" });
        return result;
      },
    },
    persistence,
  });
  return { ...services, calls, committed: () => committed };
}

function isError(error: unknown, category: ApplicationError["category"], code: string) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /Reciklirani|Metal|40\.00|75\.00|11111111|bbbbbbbb|cccccccc/);
  return true;
}

test("loads only the pointed current draft in deterministic order for PRODUCT_READ", async () => {
  const first = {
    materialId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    productVersionId: draftId,
    materialName: "Drvo",
    category: null,
    percentage: null,
    isRecycled: false,
    recycledPercentage: null,
    createdAt: new Date("2026-08-31T09:00:00.000Z"),
    updatedAt: new Date("2026-08-31T10:00:00.000Z"),
  };
  const subject = fixture({ materials: [first, fixtureMaterial()] });
  const result = await subject.get({ productId }, { ...context, membershipRole: "VIEWER", permissions: ["PRODUCT_READ"] });
  assert.deepEqual(result, {
    productId,
    expectedDraftVersionId: draftId,
    expectedProductUpdatedAt: productUpdatedAt,
    expectedDraftUpdatedAt: draftUpdatedAt,
    materials: [
      { materialId: first.materialId, materialName: "Drvo", category: null, percentage: null, isRecycled: false, recycledPercentage: null, updatedAt: first.updatedAt },
      { materialId, materialName: "Reciklirani čelik 😀", category: "Metal", percentage: "40.00", isRecycled: true, recycledPercentage: "75.00", updatedAt: materialUpdatedAt },
    ],
  });
  assert.deepEqual(subject.calls[0], { name: "loader", input: { productId, organizationId } });
});

test("adds one normalized row after exact collection validation and writes minimized audit", async () => {
  const subject = fixture({ materials: [{ ...fixtureMaterial(), percentage: "60.00" }] });
  assert.deepEqual(await subject.add({ productId, ...values, ...aggregateEvidence }, context), { productId, status: "ADDED" });
  assert.equal(subject.committed(), true);
  assert.deepEqual(subject.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "materials:read",
    "product:cas", "draft:cas", "material:insert", "audit", "transaction:commit",
  ]);
  const insert = subject.calls.find(({ name }) => name === "material:insert")!;
  assert.deepEqual(insert.input, {
    productVersionId: draftId,
    values: { materialName: "Reciklirani čelik 😀", category: "Metal", percentage: "40.00", isRecycled: true, recycledPercentage: "75.00" },
  });
  const audit = subject.calls.find(({ name }) => name === "audit")!;
  assert.deepEqual(audit.input, { organizationId, actorId: userId, productId, operation: "ADD", correlationId: "materials-correlation" });
  assert.doesNotMatch(JSON.stringify(audit), /Reciklirani|Metal|40\.00|75\.00|cccccccc/);
});

test("allows EDITOR ADMIN and OWNER after revalidation and permits READY_FOR_REVIEW", async () => {
  for (const membershipRole of ["EDITOR", "ADMIN", "OWNER"] as const) {
    const subject = fixture({
      eligibility: { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole },
      draft: {
        productVersionId: draftId,
        productId,
        organizationId,
        status: "READY_FOR_REVIEW",
        updatedAt: draftUpdatedAt,
      },
    });
    assert.deepEqual(
      await subject.add({ productId, ...values, ...aggregateEvidence }, {
        ...context,
        membershipRole,
      }),
      { productId, status: "ADDED" },
    );
  }
});

test("rejects an exact decimal total over 100 without writes or audit", async () => {
  const subject = fixture({ materials: [{ ...fixtureMaterial(), percentage: "60.01" }] });
  await assert.rejects(
    subject.add({ productId, ...values, ...aggregateEvidence }, context),
    (error) => isError(error, "VALIDATION", "PRODUCT_MATERIALS_COLLECTION_INVALID"),
  );
  assert.equal(subject.committed(), false);
  assert.equal(subject.calls.some(({ name }) => /cas|insert|audit/.test(name)), false);
});

test("edits with row CAS, reports changed fields, and validates unchanged rows before no-op", async () => {
  const subject = fixture();
  const command = {
    productId,
    materialId,
    ...values,
    category: "  Legura  ",
    ...aggregateEvidence,
    expectedMaterialUpdatedAt: materialUpdatedAt.toISOString(),
  };
  assert.deepEqual(await subject.edit(command, context), { productId, status: "UPDATED" });
  assert.deepEqual(subject.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "material:read",
    "materials:read", "product:cas", "draft:cas", "material:update", "audit", "transaction:commit",
  ]);
  assert.deepEqual((subject.calls.find(({ name }) => name === "audit")!.input as { changedFields: string[] }).changedFields, ["category"]);

  const noChange = fixture();
  const result = await noChange.edit({
    productId,
    materialId,
    materialName: " Reciklirani čelik 😀 ",
    category: "Metal",
    percentage: "40",
    isRecycled: true,
    recycledPercentage: "75",
    ...aggregateEvidence,
    expectedMaterialUpdatedAt: materialUpdatedAt.toISOString(),
  }, context);
  assert.deepEqual(result, { productId, status: "NO_CHANGE" });
  assert.deepEqual(noChange.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "material:read", "materials:read", "transaction:commit",
  ]);
});

test("removes only an owned current-draft row with row CAS and one audit", async () => {
  const subject = fixture();
  assert.deepEqual(await subject.remove({
    productId,
    materialId,
    ...aggregateEvidence,
    expectedMaterialUpdatedAt: materialUpdatedAt.toISOString(),
  }, context), { productId, status: "REMOVED" });
  assert.deepEqual(subject.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "material:read",
    "materials:read", "product:cas", "draft:cas", "material:delete", "audit", "transaction:commit",
  ]);
  assert.deepEqual(subject.calls.find(({ name }) => name === "audit")!.input, {
    organizationId, actorId: userId, productId, operation: "REMOVE", correlationId: "materials-correlation",
  });
});

test("fails closed for authority, ownership, draft state, and every CAS mismatch", async () => {
  const add = { productId, ...values, ...aggregateEvidence };
  await assert.rejects(fixture().add(add, null), (error) => isError(error, "UNAUTHENTICATED", "PRODUCT_MATERIALS_UNAUTHENTICATED"));
  await assert.rejects(fixture().add(add, { ...context, permissions: ["PRODUCT_READ"] }), (error) => isError(error, "FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN"));
  await assert.rejects(fixture({ eligibility: { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "VIEWER" } }).add(add, context), (error) => isError(error, "FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN"));
  await assert.rejects(fixture({ eligibility: { organizationStatus: "ACTIVE", membershipStatus: "SUSPENDED", membershipRole: "EDITOR" } }).add(add, context), (error) => isError(error, "FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN"));
  await assert.rejects(fixture({ eligibility: { organizationStatus: "SUSPENDED", membershipStatus: "ACTIVE", membershipRole: "EDITOR" } }).add(add, context), (error) => isError(error, "FORBIDDEN", "PRODUCT_MATERIALS_FORBIDDEN"));
  await assert.rejects(fixture({ product: null }).add(add, context), (error) => isError(error, "NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND"));
  await assert.rejects(fixture({ product: { productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: null, updatedAt: productUpdatedAt } }).add(add, context), (error) => isError(error, "INVALID_STATE", "PRODUCT_MATERIALS_DRAFT_NOT_EDITABLE"));
  for (const status of ["PUBLISHED", "SUPERSEDED", "DISCARDED"] as const) {
    await assert.rejects(fixture({ draft: { productVersionId: draftId, productId, organizationId, status, updatedAt: draftUpdatedAt } }).add(add, context), (error) => isError(error, "INVALID_STATE", "PRODUCT_MATERIALS_DRAFT_NOT_EDITABLE"));
  }
  for (const cas of ["product", "draft"] as const) {
    const subject = fixture({ cas });
    await assert.rejects(subject.add(add, context), (error) => isError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE"));
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
  }
  await assert.rejects(
    fixture().add({ ...add, expectedProductUpdatedAt: "2026-09-01T10:00:01.000Z" }, context),
    (error) => isError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE"),
  );
  await assert.rejects(
    fixture().add({ ...add, expectedDraftUpdatedAt: "2026-09-01T10:01:01.000Z" }, context),
    (error) => isError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE"),
  );

  const editCommand = normalizeEditProductMaterialCommand({
    productId, materialId, ...values, ...aggregateEvidence,
    expectedMaterialUpdatedAt: materialUpdatedAt.toISOString(),
  }, context.correlationId);
  assert.equal(editCommand.materialId, materialId);
  await assert.rejects(fixture({ material: null }).edit({ ...editCommand, expectedProductUpdatedAt: productUpdatedAt.toISOString(), expectedDraftUpdatedAt: draftUpdatedAt.toISOString(), expectedMaterialUpdatedAt: materialUpdatedAt.toISOString() }, context), (error) => isError(error, "NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND"));
  await assert.rejects(fixture().edit({ productId, materialId, ...values, category: "Alloy", ...aggregateEvidence, expectedMaterialUpdatedAt: "2026-09-01T10:02:01.000Z" }, context), (error) => isError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE"));
  await assert.rejects(fixture({ cas: "material" }).edit({ productId, materialId, ...values, category: "Alloy", ...aggregateEvidence, expectedMaterialUpdatedAt: materialUpdatedAt.toISOString() }, context), (error) => isError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE"));
  await assert.rejects(fixture({ material: null }).remove({ productId, materialId, ...aggregateEvidence, expectedMaterialUpdatedAt: materialUpdatedAt.toISOString() }, context), (error) => isError(error, "NOT_FOUND", "PRODUCT_MATERIALS_NOT_FOUND"));
  const staleRemove = fixture({ cas: "material" });
  await assert.rejects(staleRemove.remove({ productId, materialId, ...aggregateEvidence, expectedMaterialUpdatedAt: materialUpdatedAt.toISOString() }, context), (error) => isError(error, "CONFLICT", "PRODUCT_MATERIALS_STALE_WRITE"));
  assert.equal(staleRemove.committed(), false);
  assert.equal(staleRemove.calls.some(({ name }) => name === "audit"), false);
});

function fixtureMaterial() {
  return {
    materialId,
    productVersionId: draftId,
    materialName: "Reciklirani čelik 😀",
    category: "Metal",
    percentage: "40.00",
    isRecycled: true,
    recycledPercentage: "75.00",
    createdAt: new Date("2026-09-01T09:00:00.000Z"),
    updatedAt: materialUpdatedAt,
  } as const;
}
