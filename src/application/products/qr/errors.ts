import { ApplicationError, type ApplicationErrorCategory } from "@/src/application/errors/application-error";
import type { QrFailure } from "./contracts";
const categories: Record<QrFailure, ApplicationErrorCategory> = {
  UNAUTHENTICATED: "UNAUTHENTICATED", FORBIDDEN: "FORBIDDEN", NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION", STALE_WRITE: "CONFLICT", INVALID_STATE: "INVALID_STATE",
  NOT_ACTIVE: "INVALID_STATE", OPERATIONAL_FAILURE: "INTERNAL",
};
export class ProductQrError extends ApplicationError {
  constructor(readonly status: QrFailure) {
    super(categories[status], `PRODUCT_QR_${status}`, "The QR operation could not be completed.", false);
  }
}
export async function protectQrOperation<Result>(work: () => Promise<Result>): Promise<Result> {
  try { return await work(); } catch (error) {
    if (error instanceof ProductQrError) throw error;
    throw new ProductQrError("OPERATIONAL_FAILURE");
  }
}
