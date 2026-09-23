import type { AuthenticatedUserContext, MembershipRole } from "../context/authenticated-user-context";
export type BillingPermission = "BILLING_PROFILE_READ" | "BILLING_PROFILE_UPDATE";
const permissions: Readonly<Record<MembershipRole,readonly BillingPermission[]>> = {
  OWNER:["BILLING_PROFILE_READ","BILLING_PROFILE_UPDATE"],
  ADMIN:["BILLING_PROFILE_READ","BILLING_PROFILE_UPDATE"],EDITOR:[],VIEWER:[],
};
export function billingPermissionsForRole(role:MembershipRole):readonly BillingPermission[] { return permissions[role]; }
export function hasBillingPermission(context:AuthenticatedUserContext,permission:BillingPermission) {
  return context.membershipStatus === "ACTIVE" && permissions[context.membershipRole].includes(permission) && context.permissions.includes(permission);
}
