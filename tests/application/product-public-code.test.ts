import assert from "node:assert/strict";
import nodeCrypto from "node:crypto";
import test, { mock } from "node:test";

import { ApplicationError } from "../../src/application/errors/application-error";
import {
  assertValidProductPublicCode,
  type ProductPublicCodeGenerator,
} from "../../src/application/products/create-product/public-code";
import { NodeProductPublicCodeGenerator } from "../../src/infrastructure/crypto/node-product-public-code-generator";

const correlationId = "corr-product-public-code";

function isInternalPublicCodeError(error: unknown): error is ApplicationError {
  return (
    error instanceof ApplicationError &&
    error.category === "INTERNAL" &&
    error.code === "CREATE_PRODUCT_PUBLIC_CODE_INVALID" &&
    error.retryable === false &&
    error.correlationId === correlationId
  );
}

test("encodes 16 bytes as the exact unpadded base64url public-code primitive", () => {
  const generator = new NodeProductPublicCodeGenerator(() =>
    Buffer.from("000102030405060708090a0b0c0d0e0f", "hex"),
  );

  const value = generator.generate();

  assert.equal(value, "AAECAwQFBgcICQoLDA0ODw");
  assert.equal(value.length, 22);
  assert.match(value, /^[A-Za-z0-9_-]{22}$/);
  assert.doesNotMatch(value, /=/);
});

test("requests exactly 16 random bytes for each independent public-code candidate", () => {
  const sizes: number[] = [];
  const values = [Buffer.alloc(16), Buffer.alloc(16, 1)];
  const generator = new NodeProductPublicCodeGenerator((size) => {
    sizes.push(size);
    const value = values.shift();

    if (value === undefined) {
      throw new Error("Unexpected additional public-code candidate.");
    }

    return value;
  });

  assert.deepEqual([generator.generate(), generator.generate()], [
    "AAAAAAAAAAAAAAAAAAAAAA",
    "AQEBAQEBAQEBAQEBAQEBAQ",
  ]);
  assert.deepEqual(sizes, [16, 16]);
});

test("default generator calls native randomBytes once with 16 bytes", (context) => {
  const randomBytes = mock.method(nodeCrypto, "randomBytes", (size: number) => {
    assert.equal(size, 16);
    return Buffer.alloc(16, 255);
  });
  context.after(() => randomBytes.mock.restore());

  const value = new NodeProductPublicCodeGenerator().generate();

  assert.match(value, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(randomBytes.mock.callCount(), 1);
});

test("generates a public code without Product or Organization input", () => {
  const generator: ProductPublicCodeGenerator = new NodeProductPublicCodeGenerator(() =>
    Buffer.alloc(16),
  );

  assert.equal(generator.generate.length, 0);
  assert.equal(generator.generate(), "AAAAAAAAAAAAAAAAAAAAAA");
});

test("rejects malformed generator output without exposing the value", () => {
  for (const value of ["not valid", "=".repeat(22), "A".repeat(21)]) {
    assert.throws(() => assertValidProductPublicCode(value, correlationId), (error) => {
      if (!isInternalPublicCodeError(error)) {
        return false;
      }

      assert.doesNotMatch(error.message, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return true;
    });
  }
});
