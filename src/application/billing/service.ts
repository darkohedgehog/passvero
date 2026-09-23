import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { ApplicationError } from "../errors/application-error";
import { hasBillingPermission } from "../permissions/billing-permissions";
import { billingCommandSchema, type BillingCommand, type BillingProfile } from "./contracts";
export function billingError(category:ApplicationError["category"],code:string) {
  return new ApplicationError(category,code,"The billing profile request could not be completed.",false);
}
export interface BillingPersistence {
  get(context:AuthenticatedUserContext):Promise<BillingProfile|null>;
  save(context:AuthenticatedUserContext,command:BillingCommand):Promise<{status:"SAVED"|"NO_CHANGE";revision:number}>;
}
export function createBillingServices(persistence:BillingPersistence) {
  function authorize(context:AuthenticatedUserContext|null,write:boolean):asserts context is AuthenticatedUserContext {
    if(!context || !hasBillingPermission(context,write?"BILLING_PROFILE_UPDATE":"BILLING_PROFILE_READ"))throw billingError("FORBIDDEN","FORBIDDEN");
  }
  return {
    async get(context:AuthenticatedUserContext|null) {authorize(context,false);return persistence.get(context);},
    async save(input:unknown,context:AuthenticatedUserContext|null) {
      authorize(context,true);
      const command=billingCommandSchema.safeParse(input);
      if(!command.success)throw billingError("VALIDATION","VALIDATION_ERROR");
      return persistence.save(context,command.data);
    },
  };
}
