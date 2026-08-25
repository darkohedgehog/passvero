import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createActivationDigesters } from "../../src/infrastructure/auth/activation-digests";

function encode(parts: readonly Uint8Array[]): Buffer {
  const encoded: Buffer[] = [];
  for (const part of parts) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(part.byteLength);
    encoded.push(length, Buffer.from(part));
  }
  return Buffer.concat(encoded);
}

test("derives the exact versioned capability HMAC from canonical 32-byte base64url", async () => {
  const capabilityKey = Buffer.alloc(32, 0x11);
  const emailKey = Buffer.alloc(32, 0x22);
  const capabilityBytes = Buffer.alloc(32, 0x33);
  const capability = capabilityBytes.toString("base64url");
  const digesters = createActivationDigesters({ capabilityKey, emailKey });
  const expected = createHmac("sha256", capabilityKey)
    .update(encode([
      Buffer.from("passvero-auth-activation-capability"),
      Buffer.from("v1"),
      capabilityBytes,
    ]))
    .digest("base64url");

  assert.equal(await digesters.capabilityDigester.digest(capability), expected);
  assert.equal(expected.length, 43);
});

test("rejects padded, wrong-length, noncanonical, and malformed capabilities before HMAC", async () => {
  const digesters = createActivationDigesters({
    capabilityKey: Buffer.alloc(32, 0x11),
    emailKey: Buffer.alloc(32, 0x22),
  });
  const valid = Buffer.alloc(32, 0x33).toString("base64url");

  for (const candidate of [
    `${valid}=`,
    valid.slice(1),
    `${valid.slice(0, -1)}+`,
    `${valid.slice(0, -1)}B`,
  ]) {
    assert.equal(await digesters.capabilityDigester.digest(candidate), null);
  }
});

test("matches intended email with a separate domain-separated key and constant-length digest", async () => {
  const digesters = createActivationDigesters({
    capabilityKey: Buffer.alloc(32, 0x11),
    emailKey: Buffer.alloc(32, 0x22),
  });
  const email = "person@example.com";
  const persistedDigest = createHmac("sha256", Buffer.alloc(32, 0x22))
    .update(encode([
      Buffer.from("passvero-auth-activation-target-email"),
      Buffer.from("v1"),
      Buffer.from(email),
    ]))
    .digest("base64url");

  assert.equal(await digesters.intendedEmailDigester.matches({
    canonicalEmail: email,
    persistedDigest,
  }), true);
  assert.equal(await digesters.intendedEmailDigester.matches({
    canonicalEmail: "other@example.com",
    persistedDigest,
  }), false);
  assert.equal(await digesters.intendedEmailDigester.matches({
    canonicalEmail: email,
    persistedDigest: "invalid",
  }), false);
});

test("rejects reused, short, or identical digest keys without exposing key material", () => {
  const key = Buffer.alloc(32, 0x44);

  assert.throws(
    () => createActivationDigesters({ capabilityKey: key, emailKey: key }),
    (error: unknown) => error instanceof Error
      && error.message === "Activation digest key configuration is invalid.",
  );
  assert.throws(
    () => createActivationDigesters({
      capabilityKey: Buffer.alloc(31),
      emailKey: Buffer.alloc(32),
    }),
    /Activation digest key configuration is invalid\./,
  );
});
