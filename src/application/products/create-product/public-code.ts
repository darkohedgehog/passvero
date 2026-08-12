import { ApplicationError } from "@/src/application/errors/application-error";

export interface ProductPublicCodeGenerator {
  generate(): string;
}

const PRODUCT_PUBLIC_CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function assertValidProductPublicCode(
  value: string,
  correlationId: string,
): string {
  if (!PRODUCT_PUBLIC_CODE_PATTERN.test(value)) {
    throw new ApplicationError(
      "INTERNAL",
      "CREATE_PRODUCT_PUBLIC_CODE_INVALID",
      "The generated product public code is invalid.",
      false,
      correlationId,
    );
  }

  return value;
}
