import type { ProductPermission } from "../permissions/product-permissions";

export type MembershipRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";

export interface AuthenticatedUserContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly membershipRole: MembershipRole;
  readonly membershipStatus: MembershipStatus;
  readonly permissions: readonly ProductPermission[];
  readonly correlationId: string;
}
