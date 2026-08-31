import { ApplicationError } from "@/src/application/errors/application-error";
import type { EditProductDraftCommand } from "@/src/application/products/edit-product-draft/contracts";

export interface NormalizedEditProductDraftCommand {
  readonly productId: string;
  readonly productName: string;
  readonly sku: string | null;
  readonly normalizedSku: string | null;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
  readonly expectedSourceTranslationUpdatedAt: Date;
}

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_SKU_LENGTH = 128;

export function normalizeEditProductDraftCommand(
  command: EditProductDraftCommand,
  correlationId: string,
): NormalizedEditProductDraftCommand {
  if (!CANONICAL_UUID_PATTERN.test(command.productId)) {
    throw validationError("EDIT_PRODUCT_DRAFT_ID_INVALID", correlationId);
  }
  if (!CANONICAL_UUID_PATTERN.test(command.expectedDraftVersionId)) {
    throw validationError("EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID", correlationId);
  }

  const productName = command.productName.trim();
  if (!hasLengthWithin(productName, 1, MAX_PRODUCT_NAME_LENGTH)) {
    throw validationError("EDIT_PRODUCT_DRAFT_NAME_INVALID", correlationId);
  }

  const sku = command.organizationSku?.trim() ?? null;
  if (sku !== null && sku !== "" && !hasLengthWithin(sku, 1, MAX_SKU_LENGTH)) {
    throw validationError("EDIT_PRODUCT_DRAFT_SKU_INVALID", correlationId);
  }
  const normalizedSku = sku === "" ? null : sku;

  return {
    productId: command.productId,
    productName,
    sku: normalizedSku,
    normalizedSku,
    expectedDraftVersionId: command.expectedDraftVersionId,
    expectedProductUpdatedAt: parseTimestamp(command.expectedProductUpdatedAt, correlationId),
    expectedDraftUpdatedAt: parseTimestamp(command.expectedDraftUpdatedAt, correlationId),
    expectedSourceTranslationUpdatedAt: parseTimestamp(
      command.expectedSourceTranslationUpdatedAt,
      correlationId,
    ),
  };
}

function parseTimestamp(value: string, correlationId: string): Date {
  if (!CANONICAL_TIMESTAMP_PATTERN.test(value)) {
    throw validationError("EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID", correlationId);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw validationError("EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID", correlationId);
  }
  return parsed;
}

function hasLengthWithin(value: string, min: number, max: number): boolean {
  const length = Array.from(value).length;
  return length >= min && length <= max;
}

function validationError(
  code:
    | "EDIT_PRODUCT_DRAFT_ID_INVALID"
    | "EDIT_PRODUCT_DRAFT_CONCURRENCY_INVALID"
    | "EDIT_PRODUCT_DRAFT_NAME_INVALID"
    | "EDIT_PRODUCT_DRAFT_SKU_INVALID",
  correlationId: string,
): ApplicationError {
  return new ApplicationError(
    "VALIDATION",
    code,
    "The product edit request is invalid.",
    false,
    correlationId,
  );
}
