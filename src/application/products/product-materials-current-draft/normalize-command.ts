import { ApplicationError } from "@/src/application/errors/application-error";
import type {
  AddProductMaterialCommand,
  EditProductMaterialCommand,
  ProductMaterialValues,
  RemoveProductMaterialCommand,
} from "@/src/application/products/product-materials-current-draft/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DECIMAL_PERCENTAGE = /^(?:(?:0|[1-9]\d?)(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/;

export interface NormalizedProductMaterialEvidence {
  readonly productId: string;
  readonly expectedDraftVersionId: string;
  readonly expectedProductUpdatedAt: Date;
  readonly expectedDraftUpdatedAt: Date;
}

export interface NormalizedAddProductMaterialCommand
extends ProductMaterialValues, NormalizedProductMaterialEvidence {}

export interface NormalizedEditProductMaterialCommand
extends NormalizedAddProductMaterialCommand {
  readonly materialId: string;
  readonly expectedMaterialUpdatedAt: Date;
}

export interface NormalizedRemoveProductMaterialCommand
extends NormalizedProductMaterialEvidence {
  readonly materialId: string;
  readonly expectedMaterialUpdatedAt: Date;
}

export function normalizeAddProductMaterialCommand(
  command: AddProductMaterialCommand,
  correlationId: string,
): NormalizedAddProductMaterialCommand {
  return {
    ...normalizeEvidence(command, correlationId),
    ...normalizeValues(command, correlationId),
  };
}

export function normalizeEditProductMaterialCommand(
  command: EditProductMaterialCommand,
  correlationId: string,
): NormalizedEditProductMaterialCommand {
  if (!UUID.test(command.materialId)) throw invalid("PRODUCT_MATERIALS_MATERIAL_ID_INVALID", correlationId);
  return {
    ...normalizeAddProductMaterialCommand(command, correlationId),
    materialId: command.materialId,
    expectedMaterialUpdatedAt: parseTimestamp(command.expectedMaterialUpdatedAt, correlationId),
  };
}

export function normalizeRemoveProductMaterialCommand(
  command: RemoveProductMaterialCommand,
  correlationId: string,
): NormalizedRemoveProductMaterialCommand {
  if (!UUID.test(command.materialId)) throw invalid("PRODUCT_MATERIALS_MATERIAL_ID_INVALID", correlationId);
  return {
    ...normalizeEvidence(command, correlationId),
    materialId: command.materialId,
    expectedMaterialUpdatedAt: parseTimestamp(command.expectedMaterialUpdatedAt, correlationId),
  };
}

export function percentageToHundredths(value: string | null): bigint {
  if (value === null) return BigInt(0);
  const match = DECIMAL_PERCENTAGE.exec(value);
  if (match === null) throw new Error("Invalid normalized percentage");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

function normalizeEvidence(
  command: ProductMaterialConcurrencyInput,
  correlationId: string,
): NormalizedProductMaterialEvidence {
  if (!UUID.test(command.productId) || !UUID.test(command.expectedDraftVersionId)) {
    throw invalid("PRODUCT_MATERIALS_CONCURRENCY_INVALID", correlationId);
  }
  return {
    productId: command.productId,
    expectedDraftVersionId: command.expectedDraftVersionId,
    expectedProductUpdatedAt: parseTimestamp(command.expectedProductUpdatedAt, correlationId),
    expectedDraftUpdatedAt: parseTimestamp(command.expectedDraftUpdatedAt, correlationId),
  };
}

function normalizeValues(command: ProductMaterialValues, correlationId: string): ProductMaterialValues {
  const materialName = normalizeRequiredText(command.materialName, 200, "MATERIAL_NAME", correlationId);
  const category = normalizeOptionalText(command.category, 100, "CATEGORY", correlationId);
  const percentage = normalizePercentage(command.percentage, "PERCENTAGE", correlationId);
  if (typeof command.isRecycled !== "boolean") {
    throw invalid("PRODUCT_MATERIALS_IS_RECYCLED_INVALID", correlationId);
  }
  const recycledPercentage = normalizePercentage(
    command.recycledPercentage,
    "RECYCLED_PERCENTAGE",
    correlationId,
  );
  if (!command.isRecycled && recycledPercentage !== null) {
    throw invalid("PRODUCT_MATERIALS_RECYCLED_PERCENTAGE_INVALID", correlationId);
  }
  return { materialName, category, percentage, isRecycled: command.isRecycled, recycledPercentage };
}

function normalizeRequiredText(
  value: unknown,
  maximum: number,
  field: string,
  correlationId: string,
): string {
  if (typeof value !== "string") throw invalid(`PRODUCT_MATERIALS_${field}_INVALID`, correlationId);
  const normalized = value.trim();
  if (normalized.length === 0 || Array.from(normalized).length > maximum) {
    throw invalid(`PRODUCT_MATERIALS_${field}_INVALID`, correlationId);
  }
  return normalized;
}

function normalizeOptionalText(
  value: unknown,
  maximum: number,
  field: string,
  correlationId: string,
): string | null {
  if (value !== null && typeof value !== "string") {
    throw invalid(`PRODUCT_MATERIALS_${field}_INVALID`, correlationId);
  }
  const normalized = value?.trim() ?? "";
  if (Array.from(normalized).length > maximum) {
    throw invalid(`PRODUCT_MATERIALS_${field}_INVALID`, correlationId);
  }
  return normalized.length === 0 ? null : normalized;
}

function normalizePercentage(value: unknown, field: string, correlationId: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw invalid(`PRODUCT_MATERIALS_${field}_INVALID`, correlationId);
  const match = DECIMAL_PERCENTAGE.exec(value);
  if (match === null) throw invalid(`PRODUCT_MATERIALS_${field}_INVALID`, correlationId);
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function parseTimestamp(value: unknown, correlationId: string): Date {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) {
    throw invalid("PRODUCT_MATERIALS_CONCURRENCY_INVALID", correlationId);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw invalid("PRODUCT_MATERIALS_CONCURRENCY_INVALID", correlationId);
  }
  return date;
}

function invalid(code: string, correlationId: string): ApplicationError {
  return new ApplicationError("VALIDATION", code, "The material request is invalid.", false, correlationId);
}

type ProductMaterialConcurrencyInput = Pick<
  AddProductMaterialCommand,
  "productId" | "expectedDraftVersionId" | "expectedProductUpdatedAt" | "expectedDraftUpdatedAt"
>;
