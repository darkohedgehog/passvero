import type {
  AuthenticatedUserContext,
  MembershipRole,
} from "../context/authenticated-user-context";

export const PRODUCT_CREATE = "PRODUCT_CREATE" as const;

export type ProductPermission = typeof PRODUCT_CREATE;

const rolePermissions: Readonly<Record<MembershipRole, readonly ProductPermission[]>> = {
  VIEWER: [],
  EDITOR: [PRODUCT_CREATE],
  ADMIN: [PRODUCT_CREATE],
  OWNER: [PRODUCT_CREATE],
};

export function hasProductPermission(context: AuthenticatedUserContext): boolean {
  return context.permissions.includes(PRODUCT_CREATE);
}

export function roleHasProductPermission(
  role: MembershipRole,
  permission: ProductPermission,
): boolean {
  return rolePermissions[role].includes(permission);
}
