import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { ApplicationError } from "../../src/application/errors/application-error";
import {
  normalizeAddCnClassificationCommand,
  normalizeCnCode,
  validateCnNomenclatureYear,
} from "../../src/application/products/cn-classification-current-draft/normalize-command";
import type { CnClassificationCurrentDraftPersistence } from "../../src/application/products/cn-classification-current-draft/ports";
import { CnClassificationConflictPersistenceError } from "../../src/application/products/cn-classification-current-draft/ports";
import { createCnClassificationCurrentDraftServices } from "../../src/application/products/cn-classification-current-draft/services";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const identifierId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const productUpdatedAt = new Date("2026-09-01T10:00:00.000Z");
const draftUpdatedAt = new Date("2026-09-01T10:01:00.000Z");
const identifierUpdatedAt = new Date("2026-09-01T10:02:00.000Z");

const context: AuthenticatedUserContext = {
  userId,
  organizationId,
  membershipId,
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: ["PRODUCT_READ", "PRODUCT_EDIT"],
  correlationId: "cn-correlation",
};
const evidence = {
  expectedDraftVersionId: draftId,
  expectedProductUpdatedAt: productUpdatedAt.toISOString(),
  expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
} as const;

test("normalizes only canonical or official grouped ASCII CN codes as strings", () => {
  assert.equal(normalizeCnCode("01012100", "c"), "01012100");
  assert.equal(normalizeCnCode("  0101 21 00\n", "c"), "01012100");
  for (const invalid of [
    "1012100", "010121000", "0101-21-00", "0101.21.00", "0101  21 00",
    "0101\t21 00", "０１０１２１００", "٠١٠١٢١٠٠", "0101 21 0A",
  ]) {
    assert.throws(
      () => normalizeCnCode(invalid, "c"),
      (error) => isError(error, "VALIDATION", "CN_CLASSIFICATION_VALUE_INVALID"),
      invalid,
    );
  }
});

test("validates CN years against an injected UTC calendar year without coercion", () => {
  assert.equal(validateCnNomenclatureYear(1988, 2026, "c"), 1988);
  assert.equal(validateCnNomenclatureYear(2026, 2026, "c"), 2026);
  for (const invalid of [1987, 2027, 2025.5, "2026" as never, null as never]) {
    assert.throws(
      () => validateCnNomenclatureYear(invalid, 2026, "c"),
      (error) => isError(error, "VALIDATION", "CN_CLASSIFICATION_NOMENCLATURE_YEAR_INVALID"),
    );
  }
  const normalized = normalizeAddCnClassificationCommand({
    productId,
    value: " 0101 21 00 ",
    nomenclatureYear: 2026,
    ...evidence,
  }, "c", 2026);
  assert.equal(normalized.value, "01012100");
  assert.equal(typeof normalized.value, "string");
  assert.equal(normalized.value.length, 8);
});

type Override = {
  eligibility?: null | Record<string, unknown>;
  product?: null | Record<string, unknown>;
  draft?: null | Record<string, unknown>;
  identifier?: null | Record<string, unknown>;
  loaderIdentifier?: null | Record<string, unknown>;
  loader?: null | Record<string, unknown>;
  cas?: "product" | "draft" | "identifier";
  conflict?: boolean;
};

function fixture(overrides: Override = {}) {
  const transaction = Symbol("transaction");
  const calls: Array<{ name: string; input?: unknown }> = [];
  let committed = false;
  const currentIdentifier = overrides.identifier === undefined ? identifierRecord() : overrides.identifier;
  const persistence: CnClassificationCurrentDraftPersistence<typeof transaction> = {
    async findCurrentDraftByProductAndOrganization(input) {
      calls.push({ name: "loader", input });
      return (overrides.loader === null ? null : overrides.loader ?? {
        productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: draftId,
        updatedAt: productUpdatedAt,
        currentDraftVersion: {
          productVersionId: draftId, productId, organizationId, status: "DRAFT",
          updatedAt: draftUpdatedAt, cn: overrides.loaderIdentifier === undefined ? currentIdentifier : overrides.loaderIdentifier,
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
        productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: draftId,
        updatedAt: productUpdatedAt,
      } : overrides.product) as never;
    },
    async readDraftVersion(_tx, input) {
      calls.push({ name: "draft:read", input });
      return (overrides.draft === undefined ? {
        productVersionId: draftId, productId, organizationId, status: "DRAFT", updatedAt: draftUpdatedAt,
      } : overrides.draft) as never;
    },
    async readCurrentDraftCn(_tx, input) { calls.push({ name: "cn:read", input }); return currentIdentifier as never; },
    async touchProductIfCurrent(_tx, input) { calls.push({ name: "product:cas", input }); return overrides.cas !== "product"; },
    async touchDraftVersionIfCurrent(_tx, input) { calls.push({ name: "draft:cas", input }); return overrides.cas !== "draft"; },
    async insertCn(_tx, input) {
      calls.push({ name: "cn:insert", input });
      if (overrides.conflict) throw new CnClassificationConflictPersistenceError();
      return { identifierId };
    },
    async updateCnIfCurrent(_tx, input) { calls.push({ name: "cn:update", input }); return overrides.cas !== "identifier"; },
    async deleteCnIfCurrent(_tx, input) { calls.push({ name: "cn:delete", input }); return overrides.cas !== "identifier"; },
    async insertProductUpdatedAuditEvent(_tx, input) { calls.push({ name: "audit", input }); },
  };
  const services = createCnClassificationCurrentDraftServices({
    currentUtcYear: () => 2026,
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

test("loads only zero-or-one CN row from the pointed current draft for PRODUCT_READ", async () => {
  const subject = fixture();
  const result = await subject.get({ productId }, { ...context, membershipRole: "VIEWER", permissions: ["PRODUCT_READ"] });
  assert.deepEqual(result, {
    productId,
    cn: { identifierId, value: "01012100", nomenclatureYear: 2026, updatedAt: identifierUpdatedAt },
    expectedDraftVersionId: draftId,
    expectedProductUpdatedAt: productUpdatedAt,
    expectedDraftUpdatedAt: draftUpdatedAt,
  });
  assert.deepEqual(subject.calls[0], { name: "loader", input: { productId, organizationId } });
});

test("adds one CN row with null authority and notes and exactly one minimized audit", async () => {
  const subject = fixture({ identifier: null });
  assert.deepEqual(await subject.add({ productId, value: "0101 21 00", nomenclatureYear: 2026, ...evidence }, context), { productId, status: "ADDED" });
  assert.deepEqual(subject.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "cn:read",
    "product:cas", "draft:cas", "cn:insert", "audit", "transaction:commit",
  ]);
  assert.deepEqual(subject.calls.find(({ name }) => name === "cn:insert")?.input, {
    productVersionId: draftId,
    values: { value: "01012100", nomenclatureYear: 2026, issuingAuthority: null, notes: null },
  });
  assert.deepEqual(subject.calls.find(({ name }) => name === "audit")?.input, {
    organizationId, actorId: userId, productId, operation: "ADD", correlationId: "cn-correlation",
  });
  assert.doesNotMatch(JSON.stringify(subject.calls.find(({ name }) => name === "audit")), /01012100|2026|cccccccc/);
});

test("allows EDITOR ADMIN and OWNER mutations after revalidation and READY_FOR_REVIEW", async () => {
  for (const membershipRole of ["EDITOR", "ADMIN", "OWNER"] as const) {
    const subject = fixture({
      identifier: null,
      eligibility: { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole },
      draft: { productVersionId: draftId, productId, organizationId, status: "READY_FOR_REVIEW", updatedAt: draftUpdatedAt },
    });
    assert.deepEqual(
      await subject.add({ productId, value: "01012100", nomenclatureYear: 2026, ...evidence }, { ...context, membershipRole }),
      { productId, status: "ADDED" },
    );
  }
});

test("returns an explicit empty current-draft CN state without consulting published rows", async () => {
  const subject = fixture({ identifier: null });
  const result = await subject.get({ productId }, context);
  assert.equal(result.cn, null);
  assert.equal(subject.calls.some(({ name }) => name.includes("published")), false);
});

test("rejects ADD when CN exists and safely maps the final database uniqueness race", async () => {
  for (const subject of [fixture(), fixture({ identifier: null, conflict: true })]) {
    await assert.rejects(
      subject.add({ productId, value: "01012100", nomenclatureYear: 2026, ...evidence }, context),
      (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_CONFLICT"),
    );
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
  }
});

test("maps only a losing ADD aggregate race with a newly present current-draft CN to conflict", async () => {
  for (const cas of ["product", "draft"] as const) {
    const subject = fixture({ identifier: null, loaderIdentifier: identifierRecord(), cas });
    await assert.rejects(
      subject.add({ productId, value: "02022200", nomenclatureYear: 2026, ...evidence }, context),
      (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_CONFLICT"),
    );
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
    assert.deepEqual(subject.calls.at(-1), { name: "loader", input: { productId, organizationId } });
  }
});

test("keeps a losing ADD aggregate race stale when the fresh current draft has no CN", async () => {
  for (const cas of ["product", "draft"] as const) {
    const subject = fixture({ identifier: null, loaderIdentifier: null, cas });
    await assert.rejects(
      subject.add({ productId, value: "02022200", nomenclatureYear: 2026, ...evidence }, context),
      (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_STALE_WRITE"),
    );
    assert.equal(subject.committed(), false);
    assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
    assert.deepEqual(subject.calls.at(-1), { name: "loader", input: { productId, organizationId } });
  }
});

test("maps a missing tenant-scoped ADD classification resource to NOT_FOUND", async () => {
  const subject = fixture({ identifier: null, cas: "product", loader: null });
  await assert.rejects(
    subject.add({ productId, value: "02022200", nomenclatureYear: 2026, ...evidence }, context),
    (error) => isError(error, "NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND"),
  );
  assert.equal(subject.committed(), false);
  assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
  assert.deepEqual(subject.calls.at(-1), { name: "loader", input: { productId, organizationId } });
});

test("edits atomically with row CAS and validates concurrency before a normalized no-op", async () => {
  const command = {
    productId, identifierId, value: "0202 22 00", nomenclatureYear: 2025, ...evidence,
    expectedIdentifierUpdatedAt: identifierUpdatedAt.toISOString(),
  };
  const changed = fixture();
  assert.deepEqual(await changed.edit(command, context), { productId, status: "UPDATED" });
  assert.deepEqual(changed.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "cn:read",
    "product:cas", "draft:cas", "cn:update", "audit", "transaction:commit",
  ]);
  assert.deepEqual((changed.calls.find(({ name }) => name === "audit")?.input as { changedFields: string[] }).changedFields, ["value", "nomenclatureYear"]);

  const noChange = fixture();
  assert.deepEqual(await noChange.edit({ ...command, value: " 0101 21 00 ", nomenclatureYear: 2026 }, context), { productId, status: "NO_CHANGE" });
  assert.deepEqual(noChange.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "cn:read", "transaction:commit",
  ]);

  await assert.rejects(
    fixture().edit({ ...command, value: "01012100", nomenclatureYear: 2026, expectedIdentifierUpdatedAt: "2026-09-01T10:02:01.000Z" }, context),
    (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_STALE_WRITE"),
  );
});

test("returns safe NOT_FOUND for a missing EDIT target before validating replacement values", async () => {
  await assert.rejects(
    fixture({ identifier: null }).edit({
      productId,
      identifierId,
      value: "invalid",
      nomenclatureYear: 2027,
      ...evidence,
      expectedIdentifierUpdatedAt: identifierUpdatedAt.toISOString(),
    }, context),
    (error) => isError(error, "NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND"),
  );
});

test("removes only the exact current-draft CN row with row CAS and one audit", async () => {
  const subject = fixture();
  assert.deepEqual(await subject.remove({ productId, identifierId, ...evidence, expectedIdentifierUpdatedAt: identifierUpdatedAt.toISOString() }, context), { productId, status: "REMOVED" });
  assert.deepEqual(subject.calls.map(({ name }) => name), [
    "transaction:start", "eligibility", "product:read", "draft:read", "cn:read",
    "product:cas", "draft:cas", "cn:delete", "audit", "transaction:commit",
  ]);
});

test("fails closed for permissions tenant draft ownership and every CAS mismatch", async () => {
  const add = { productId, value: "01012100", nomenclatureYear: 2026, ...evidence };
  await assert.rejects(fixture({ identifier: null }).add(add, null), (error) => isError(error, "UNAUTHENTICATED", "CN_CLASSIFICATION_UNAUTHENTICATED"));
  await assert.rejects(fixture({ identifier: null }).add(add, { ...context, permissions: ["PRODUCT_READ"] }), (error) => isError(error, "FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN"));
  await assert.rejects(fixture({ identifier: null, eligibility: { organizationStatus: "ACTIVE", membershipStatus: "ACTIVE", membershipRole: "VIEWER" } }).add(add, context), (error) => isError(error, "FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN"));
  await assert.rejects(fixture({ identifier: null, eligibility: { organizationStatus: "ACTIVE", membershipStatus: "SUSPENDED", membershipRole: "EDITOR" } }).add(add, context), (error) => isError(error, "FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN"));
  await assert.rejects(fixture({ identifier: null, eligibility: { organizationStatus: "SUSPENDED", membershipStatus: "ACTIVE", membershipRole: "EDITOR" } }).add(add, context), (error) => isError(error, "FORBIDDEN", "CN_CLASSIFICATION_FORBIDDEN"));
  await assert.rejects(fixture({ identifier: null, product: null }).add(add, context), (error) => isError(error, "NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND"));
  await assert.rejects(fixture({ identifier: null, product: { productId, organizationId, lifecycleStatus: "ACTIVE", currentDraftVersionId: null, updatedAt: productUpdatedAt } }).add(add, context), (error) => isError(error, "INVALID_STATE", "CN_CLASSIFICATION_DRAFT_NOT_EDITABLE"));
  for (const status of ["PUBLISHED", "SUPERSEDED", "DISCARDED"] as const) {
    await assert.rejects(fixture({ identifier: null, draft: { productVersionId: draftId, productId, organizationId, status, updatedAt: draftUpdatedAt } }).add(add, context), (error) => isError(error, "INVALID_STATE", "CN_CLASSIFICATION_DRAFT_NOT_EDITABLE"));
  }
  for (const cas of ["product", "draft"] as const) {
    const subject = fixture({ identifier: null, cas });
    await assert.rejects(subject.add(add, context), (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_STALE_WRITE"));
    assert.equal(subject.calls.some(({ name }) => name === "audit"), false);
  }
  const edit = { productId, identifierId, value: "02022200", nomenclatureYear: 2026, ...evidence, expectedIdentifierUpdatedAt: identifierUpdatedAt.toISOString() };
  await assert.rejects(fixture({ identifier: null }).edit(edit, context), (error) => isError(error, "NOT_FOUND", "CN_CLASSIFICATION_NOT_FOUND"));
  await assert.rejects(fixture({ cas: "identifier" }).edit(edit, context), (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_STALE_WRITE"));
  await assert.rejects(fixture({ cas: "identifier" }).remove({ productId, identifierId, ...evidence, expectedIdentifierUpdatedAt: identifierUpdatedAt.toISOString() }, context), (error) => isError(error, "CONFLICT", "CN_CLASSIFICATION_STALE_WRITE"));
});

function identifierRecord() {
  return {
    identifierId, productVersionId: draftId, type: "CN" as const, value: "01012100",
    nomenclatureYear: 2026, issuingAuthority: null, notes: null,
    createdAt: new Date("2026-09-01T09:00:00.000Z"), updatedAt: identifierUpdatedAt,
  };
}

function isError(error: unknown, category: ApplicationError["category"], code: string) {
  assert.ok(error instanceof ApplicationError);
  assert.equal(error.category, category);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /01012100|2026|11111111|bbbbbbbb|cccccccc|constraint|Prisma/i);
  return true;
}
