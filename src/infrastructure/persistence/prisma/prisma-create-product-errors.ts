import {
  CreateProductPersistenceError,
  type CreateProductPersistenceErrorKind,
} from "@/src/application/products/create-product/ports";

export type CreateProductPrismaOperation =
  | "createProductIdentity"
  | "createInitialProductVersion"
  | "assignCurrentDraft"
  | "insertAudit";

const P2002 = "P2002";

export function translatePrismaCreateProductError(
  error: unknown,
  operation: CreateProductPrismaOperation,
): CreateProductPersistenceError {
  return new CreateProductPersistenceError(resolveKind(error, operation));
}

function resolveKind(
  error: unknown,
  operation: CreateProductPrismaOperation,
): CreateProductPersistenceErrorKind {
  if (!isP2002Error(error)) {
    return "UNKNOWN";
  }

  const target = error.meta?.target;

  if (operation === "createProductIdentity") {
    if (hasExactFieldTarget(target, ["publicCode"]) || target === "Product_publicCode_key") {
      return "PUBLIC_CODE_CONFLICT";
    }

    if (
      hasExactFieldTarget(target, ["organizationId", "normalizedSku"]) ||
      target === "Product_organizationId_normalizedSku_key"
    ) {
      return "ORGANIZATION_SKU_CONFLICT";
    }
  }

  if (
    operation === "createInitialProductVersion" &&
    target === "ux_product_version_one_active_draft"
  ) {
    return "ACTIVE_DRAFT_CONFLICT";
  }

  if (operation === "assignCurrentDraft" && hasExactFieldTarget(target, ["currentDraftVersionId"])) {
    return "POINTER_CONFLICT";
  }

  return "UNKNOWN";
}

function isP2002Error(error: unknown): error is { readonly code: string; readonly meta?: { readonly target?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === P2002
  );
}

function hasExactFieldTarget(target: unknown, fields: readonly string[]): boolean {
  return (
    Array.isArray(target) &&
    target.length === fields.length &&
    target.every((field, index) => field === fields[index])
  );
}
