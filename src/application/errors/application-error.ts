export type ApplicationErrorCategory =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "EXTERNAL_DEPENDENCY"
  | "INTERNAL";

export class ApplicationError extends Error {
  constructor(
    readonly category: ApplicationErrorCategory,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
