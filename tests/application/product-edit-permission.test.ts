import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_EDIT,
  PRODUCT_PUBLISH,
  permissionsForMembershipRole,
  roleHasProductPermission,
} from "../../src/application/permissions/product-permissions";

test("grants PRODUCT_EDIT only to EDITOR ADMIN and OWNER", () => {
  assert.equal(roleHasProductPermission("VIEWER", PRODUCT_EDIT), false);
  for (const role of ["EDITOR", "ADMIN", "OWNER"] as const) {
    assert.equal(roleHasProductPermission(role, PRODUCT_EDIT), true);
    assert.equal(permissionsForMembershipRole(role).includes(PRODUCT_EDIT), true);
  }
  assert.equal(permissionsForMembershipRole("VIEWER").includes(PRODUCT_EDIT), false);
});

test("grants PRODUCT_PUBLISH only to ADMIN and OWNER", () => {
  assert.equal(roleHasProductPermission("VIEWER", PRODUCT_PUBLISH), false);
  assert.equal(roleHasProductPermission("EDITOR", PRODUCT_PUBLISH), false);
  for (const role of ["ADMIN", "OWNER"] as const) {
    assert.equal(roleHasProductPermission(role, PRODUCT_PUBLISH), true);
    assert.equal(permissionsForMembershipRole(role).filter((permission) => permission === PRODUCT_PUBLISH).length, 1);
  }
});
