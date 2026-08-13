import assert from "node:assert/strict";
import test from "node:test";

import {
  translatePrismaCreateProductError,
  type CreateProductPrismaOperation,
} from "../../src/infrastructure/persistence/prisma/prisma-create-product-errors";

const rawMessage = "Database details must not escape the persistence boundary.";
const rawStack = "raw-prisma-stack";

function unique(target: unknown): unknown {
  return {
    code: "P2002",
    message: rawMessage,
    meta: { target },
    stack: rawStack,
  };
}

function translate(error: unknown, operation: CreateProductPrismaOperation) {
  return translatePrismaCreateProductError(error, operation);
}

test("maps only the exact Product uniqueness identities", () => {
  const cases: readonly {
    readonly name: string;
    readonly error: unknown;
    readonly operation: CreateProductPrismaOperation;
    readonly kind:
      | "PUBLIC_CODE_CONFLICT"
      | "ORGANIZATION_SKU_CONFLICT"
      | "ACTIVE_DRAFT_CONFLICT"
      | "POINTER_CONFLICT";
  }[] = [
    {
      name: "public code field target",
      error: unique(["publicCode"]),
      operation: "createProductIdentity",
      kind: "PUBLIC_CODE_CONFLICT",
    },
    {
      name: "organization SKU field target",
      error: unique(["organizationId", "normalizedSku"]),
      operation: "createProductIdentity",
      kind: "ORGANIZATION_SKU_CONFLICT",
    },
    {
      name: "draft pointer field target",
      error: unique(["currentDraftVersionId"]),
      operation: "assignCurrentDraft",
      kind: "POINTER_CONFLICT",
    },
    {
      name: "public code constraint identity",
      error: unique("Product_publicCode_key"),
      operation: "createProductIdentity",
      kind: "PUBLIC_CODE_CONFLICT",
    },
    {
      name: "organization SKU constraint identity",
      error: unique("Product_organizationId_normalizedSku_key"),
      operation: "createProductIdentity",
      kind: "ORGANIZATION_SKU_CONFLICT",
    },
    {
      name: "active draft partial-index identity",
      error: unique("ux_product_version_one_active_draft"),
      operation: "createInitialProductVersion",
      kind: "ACTIVE_DRAFT_CONFLICT",
    },
  ];

  for (const item of cases) {
    assert.equal(translate(item.error, item.operation).kind, item.kind, item.name);
  }
});

test("returns UNKNOWN for non-P2002, malformed, and wrong-operation errors", () => {
  const cases: readonly {
    readonly error: unknown;
    readonly operation: CreateProductPrismaOperation;
  }[] = [
    { error: { code: "P2025", meta: { target: ["publicCode"] } }, operation: "createProductIdentity" },
    { error: { code: "P2002" }, operation: "createProductIdentity" },
    { error: { code: "P2002", meta: { target: { field: "publicCode" } } }, operation: "createProductIdentity" },
    { error: unique(["publicCode", "organizationId"]), operation: "createProductIdentity" },
    { error: unique(["publicCode"]), operation: "insertAudit" },
    { error: unique("Product_currentDraftVersionId_key"), operation: "assignCurrentDraft" },
    { error: unique("ux_product_version_one_active_draft"), operation: "assignCurrentDraft" },
  ];

  for (const item of cases) {
    assert.equal(translate(item.error, item.operation).kind, "UNKNOWN");
  }
});

test("does not retain raw Prisma error details", () => {
  const translated = translate(unique(["publicCode"]), "createProductIdentity");

  assert.equal(translated.message, "PUBLIC_CODE_CONFLICT");
  assert.deepEqual(Object.keys(translated), ["kind"]);
  assert.doesNotMatch(translated.message, new RegExp(rawMessage));
  assert.equal(translated.stack?.includes(rawStack), false);
});
