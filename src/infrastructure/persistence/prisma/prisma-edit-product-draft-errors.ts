import { EditProductDraftPersistenceError } from "@/src/application/products/edit-product-draft/ports";

export type EditProductDraftPrismaOperation =
  | "read"
  | "updateProduct"
  | "updateDraft"
  | "updateTranslation"
  | "insertAudit";

export function translatePrismaEditProductDraftError(
  error: unknown,
  operation: EditProductDraftPrismaOperation,
): EditProductDraftPersistenceError {
  if (operation === "updateProduct" && isOrganizationSkuConflict(error)) {
    return new EditProductDraftPersistenceError("ORGANIZATION_SKU_CONFLICT");
  }
  return new EditProductDraftPersistenceError("UNKNOWN");
}

function isOrganizationSkuConflict(error: unknown): boolean {
  if (!isRecord(error) || error.code !== "P2002") return false;
  if (!isRecord(error.meta)) return false;

  const target = error.meta.target;
  if (
    target === "Product_organizationId_normalizedSku_key"
    || hasExactFields(target, ["organizationId", "normalizedSku"])
  ) {
    return true;
  }

  if (
    error.meta.modelName !== "Product"
    || !isRecord(error.meta.driverAdapterError)
    || !isRecord(error.meta.driverAdapterError.cause)
    || error.meta.driverAdapterError.cause.kind !== "UniqueConstraintViolation"
    || !isRecord(error.meta.driverAdapterError.cause.constraint)
    || !Array.isArray(error.meta.driverAdapterError.cause.constraint.fields)
  ) {
    return false;
  }

  const fields = error.meta.driverAdapterError.cause.constraint.fields.map(normalizeIdentifier);
  return fields.every((field): field is string => field !== null)
    && hasExactFields(fields, ["organizationId", "normalizedSku"]);
}

function hasExactFields(target: unknown, expected: readonly string[]): boolean {
  return Array.isArray(target)
    && target.length === expected.length
    && target.every((field, index) => field === expected[index]);
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(?:"([A-Za-z][A-Za-z0-9]*)"|([A-Za-z][A-Za-z0-9]*))$/.exec(value);
  return match?.[1] ?? match?.[2] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
