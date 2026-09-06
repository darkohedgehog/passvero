import assert from "node:assert/strict";
import test from "node:test";
import { permissionsForMembershipRole } from "../../src/application/permissions/product-permissions";
for (const [role, allowed] of [["VIEWER", false], ["EDITOR", false], ["ADMIN", true], ["OWNER", true]] as const) {
  test(`QR activation permission: ${role}`, () => {
    const permissions: readonly string[] = permissionsForMembershipRole(role);
    assert.equal(permissions.includes("QRCODE_ACTIVATE"), allowed);
    assert.equal(permissions.includes("PRODUCT_READ"), true);
    assert.equal(permissions.includes("QRCODE_REGENERATE"), false);
  });
}
