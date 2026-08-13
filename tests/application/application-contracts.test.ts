import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationError } from "../../src/application/errors/application-error";
import {
  PRODUCT_CREATE,
  roleHasProductPermission,
} from "../../src/application/permissions/product-permissions";

test("PRODUCT_CREATE is centralized and excludes VIEWER", () => {
  assert.equal(roleHasProductPermission("EDITOR", PRODUCT_CREATE), true);
  assert.equal(roleHasProductPermission("ADMIN", PRODUCT_CREATE), true);
  assert.equal(roleHasProductPermission("OWNER", PRODUCT_CREATE), true);
  assert.equal(roleHasProductPermission("VIEWER", PRODUCT_CREATE), false);
});

test("ApplicationError exposes only stable safe fields", () => {
  const error = new ApplicationError(
    "FORBIDDEN",
    "CREATE_PRODUCT_FORBIDDEN",
    "Product creation is not permitted.",
    false,
    "corr-test-0001",
  );

  assert.equal(error.category, "FORBIDDEN");
  assert.equal(error.code, "CREATE_PRODUCT_FORBIDDEN");
  assert.equal(error.correlationId, "corr-test-0001");
});
