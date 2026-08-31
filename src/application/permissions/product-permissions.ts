import type {
  AuthenticatedUserContext,
  MembershipRole,
} from "../context/authenticated-user-context";

export const PRODUCT_CREATE = "PRODUCT_CREATE" as const;
export const PRODUCT_EDIT = "PRODUCT_EDIT" as const;
export const PRODUCT_READ = "PRODUCT_READ" as const;

export type ProductPermission =
  | typeof PRODUCT_CREATE
  | typeof PRODUCT_EDIT
  | typeof PRODUCT_READ;

const rolePermissions: Readonly<Record<MembershipRole, readonly ProductPermission[]>> = {
  VIEWER: [PRODUCT_READ],
  EDITOR: [PRODUCT_READ, PRODUCT_CREATE, PRODUCT_EDIT],
  ADMIN: [PRODUCT_READ, PRODUCT_CREATE, PRODUCT_EDIT],
  OWNER: [PRODUCT_READ, PRODUCT_CREATE, PRODUCT_EDIT],
};

export function hasProductPermission(
  context: AuthenticatedUserContext,
  permission: ProductPermission,
): boolean {
  return context.permissions.includes(permission);
}

export function roleHasProductPermission(
  role: MembershipRole,
  permission: ProductPermission,
): boolean {
  return rolePermissions[role].includes(permission);
}

export function permissionsForMembershipRole(
  role: MembershipRole,
): readonly ProductPermission[] {
  return rolePermissions[role];
}
