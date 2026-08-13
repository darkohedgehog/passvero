import { ApplicationError } from "@/src/application/errors/application-error";
import type { CreateProductCommand } from "@/src/application/products/create-product/contracts";
import {
  isPassveroLocale,
  type PassveroLocale,
} from "@/src/domain/values/passvero-locale";

export interface NormalizedCreateProductCommand {
  readonly sourceLocale: PassveroLocale;
  readonly productName: string;
  readonly internalName: string;
  readonly sku: string | null;
  readonly normalizedSku: string | null;
}

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_SKU_LENGTH = 128;

export function normalizeCreateProductCommand(
  command: CreateProductCommand,
  correlationId: string,
): NormalizedCreateProductCommand {
  const sourceLocale = command.initialLocale.trim();

  if (!isPassveroLocale(sourceLocale)) {
    throw validationError(
      "CREATE_PRODUCT_LOCALE_INVALID",
      "The initial product locale is invalid.",
      correlationId,
    );
  }

  const productName = command.initialProductName.trim();

  if (!hasLengthWithin(productName, 1, MAX_PRODUCT_NAME_LENGTH)) {
    throw validationError(
      "CREATE_PRODUCT_NAME_INVALID",
      "The initial product name is invalid.",
      correlationId,
    );
  }

  const sku = command.organizationSku?.trim() ?? null;

  if (sku !== null && sku !== "" && !hasLengthWithin(sku, 1, MAX_SKU_LENGTH)) {
    throw validationError(
      "CREATE_PRODUCT_SKU_INVALID",
      "The organization SKU is invalid.",
      correlationId,
    );
  }

  const normalizedSku = sku === "" ? null : sku;

  return {
    sourceLocale,
    productName,
    internalName: productName,
    sku: normalizedSku,
    normalizedSku,
  };
}

function hasLengthWithin(value: string, min: number, max: number): boolean {
  const length = Array.from(value).length;
  return length >= min && length <= max;
}

function validationError(
  code:
    | "CREATE_PRODUCT_NAME_INVALID"
    | "CREATE_PRODUCT_LOCALE_INVALID"
    | "CREATE_PRODUCT_SKU_INVALID",
  message: string,
  correlationId: string,
): ApplicationError {
  return new ApplicationError("VALIDATION", code, message, false, correlationId);
}
