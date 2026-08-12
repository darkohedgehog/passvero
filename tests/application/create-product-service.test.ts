import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUserContext } from "../../src/application/context/authenticated-user-context";
import { PRODUCT_CREATE } from "../../src/application/permissions/product-permissions";
import { createCreateProductService } from "../../src/application/products/create-product/create-product";

const PRODUCT_ID = "product-0001";
const VERSION_ID = "product-version-0001";
const PUBLIC_CODE = "AbCdEfGhIjKlMnOpQrStUv";
const CREATED_AT = new Date("2026-08-12T12:00:00.000Z");

const activeEditorContext: AuthenticatedUserContext = {
  userId: "user-0001",
  organizationId: "organization-0001",
  membershipId: "membership-0001",
  membershipRole: "EDITOR",
  membershipStatus: "ACTIVE",
  permissions: [PRODUCT_CREATE],
  correlationId: "correlation-0001",
};

test("creates and returns one complete initial Product aggregate", async () => {
  const recordedSteps: string[] = [];
  const transactionToken = { name: "transaction-0001" };
  const service = createCreateProductService({
    transactionRunner: {
      async run(work) {
        recordedSteps.push("transaction:start");
        const result = await work(transactionToken);
        recordedSteps.push("transaction:commit");
        return result;
      },
    },
    persistence: {
      async readEligibility(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          organizationId: "organization-0001",
          userId: "user-0001",
          membershipId: "membership-0001",
        });
        recordedSteps.push("eligibility");
        return {
          organizationStatus: "ACTIVE",
          membershipStatus: "ACTIVE",
          membershipRole: "EDITOR",
        };
      },
      async createProductIdentity(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          organizationId: "organization-0001",
          internalName: "Proizvod",
          sku: "SKU-1",
          normalizedSku: "SKU-1",
          publicCode: PUBLIC_CODE,
          actorId: "user-0001",
        });
        recordedSteps.push("product");
        return { productId: PRODUCT_ID, createdAt: CREATED_AT };
      },
      async createInitialProductVersion(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          productId: PRODUCT_ID,
          organizationId: "organization-0001",
          sourceLocale: "hr",
          actorId: "user-0001",
        });
        recordedSteps.push("version");
        return { productVersionId: VERSION_ID };
      },
      async createInitialProductTranslation(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          productVersionId: VERSION_ID,
          locale: "hr",
          productName: "Proizvod",
        });
        recordedSteps.push("translation");
        return { productTranslationId: "translation-0001" };
      },
      async assignCurrentDraftVersionIfUnset(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          productId: PRODUCT_ID,
          organizationId: "organization-0001",
          productVersionId: VERSION_ID,
        });
        recordedSteps.push("pointer");
        return true;
      },
      async insertProductCreatedAuditEvent(transaction, input) {
        assert.strictEqual(transaction, transactionToken);
        assert.deepEqual(input, {
          organizationId: "organization-0001",
          actorId: "user-0001",
          productId: PRODUCT_ID,
          initialProductVersionId: VERSION_ID,
          skuSupplied: true,
          correlationId: "correlation-0001",
        });
        recordedSteps.push("audit");
        return { auditLogId: "audit-0001" };
      },
    },
    publicCodeGenerator: {
      generate() {
        return PUBLIC_CODE;
      },
    },
    monotonicNow: (() => {
      const values = [100, 143];
      return () => values.shift() ?? 143;
    })(),
    telemetry: {
      recordSuccess(input) {
        assert.deepEqual(input, { durationMs: 43 });
      },
      recordFailure() {
        assert.fail("success flow must not record failure telemetry");
      },
      recordPublicCodeCollision() {
        assert.fail("success flow must not record collision telemetry");
      },
      recordPublicCodeExhaustion() {
        assert.fail("success flow must not record exhaustion telemetry");
      },
    },
  });

  const result = await service(
    {
      initialLocale: "hr",
      initialProductName: " Proizvod ",
      organizationSku: " SKU-1 ",
    },
    activeEditorContext,
  );

  assert.deepEqual(result, {
    productId: PRODUCT_ID,
    initialProductVersionId: VERSION_ID,
    publicCode: PUBLIC_CODE,
    productStatus: "ACTIVE",
    draftStatus: "DRAFT",
    organizationSku: "SKU-1",
    createdAt: CREATED_AT,
  });
  assert.deepEqual(recordedSteps, [
    "transaction:start",
    "eligibility",
    "product",
    "version",
    "translation",
    "pointer",
    "audit",
    "transaction:commit",
  ]);
});
