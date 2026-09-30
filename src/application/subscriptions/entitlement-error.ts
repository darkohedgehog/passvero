import { ApplicationError } from "../errors/application-error";

export class EntitlementError extends ApplicationError {
  constructor(readonly organizationId: string, readonly reasons: readonly string[]) {
    super("LIMIT_EXCEEDED", reasons[0] ?? "SUBSCRIPTION_REQUIRED", "Subscription rights do not permit this operation.", false);
  }
}
