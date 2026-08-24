import assert from "node:assert/strict";
import test from "node:test";

import { createPassveroPasswordCallbacks } from "../../src/infrastructure/auth/better-auth-password-core";

const callbacks = createPassveroPasswordCallbacks();
const composed = `Caf\u00e9-${"z".repeat(10)}`;
const decomposed = `Cafe\u0301-${"z".repeat(10)}`;
const envelopePattern = /^\$passvero\$scrypt\$v=1\$N=16384\$r=16\$p=1\$dkLen=64\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/;

test("hashes prepared NFC input with a fresh Passvero scrypt-v1 salt", async () => {
  const first = await callbacks.hash(composed);
  const second = await callbacks.hash(composed);

  assert.match(first, envelopePattern);
  assert.match(second, envelopePattern);
  assert.notEqual(first, second);
  assert.equal(await callbacks.verify({ hash: first, password: composed }), true);
  assert.equal(await callbacks.verify({ hash: second, password: composed }), true);
});

test("hash applies the password policy NFC preparation before the KDF", async () => {
  const decomposedHash = await callbacks.hash(decomposed);

  assert.equal(
    await callbacks.verify({ hash: decomposedHash, password: composed }),
    true,
  );
});

test("hash rejects policy-invalid and malformed input with one secret-free error", async () => {
  const malformed = `${"x".repeat(14)}${String.fromCharCode(0xd800)}`;

  for (const password of ["short password", "correct horse battery staple", malformed]) {
    await assert.rejects(
      callbacks.hash(password),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Password credential operation failed.");
        assert.doesNotMatch(error.message, new RegExp(password));
        assert.equal("cause" in error, false);
        return true;
      },
    );
  }
});

test("verify applies NFC to the candidate and never applies NFKC", async () => {
  const composedHash = await callbacks.hash(composed);
  assert.equal(
    await callbacks.verify({ hash: composedHash, password: decomposed }),
    true,
  );

  const fullWidth = "Ａ".repeat(15);
  const fullWidthHash = await callbacks.hash(fullWidth);
  assert.equal(
    await callbacks.verify({ hash: fullWidthHash, password: "A".repeat(15) }),
    false,
  );
});

test("strictly rejects malformed, unversioned, padded, and trailing hash formats", async () => {
  const valid = await callbacks.hash(composed);
  const candidates = [
    "00:11",
    valid.replace("v=1", "v=2"),
    valid.replace("N=16384", "N=32768"),
    `${valid}=`,
    `${valid}$trailing`,
    valid.replace("$r=16$p=1", "$p=1$r=16"),
  ];

  for (const hash of candidates) {
    assert.equal(await callbacks.verify({ hash, password: composed }), false);
  }
});

test("returns generic false for a wrong password without logging credential material", async () => {
  const raw = `private-${"phrase".repeat(3)}`;
  const hash = await callbacks.hash(raw);
  const originalLog = console.log;
  const originalDebug = console.debug;
  const messages: unknown[] = [];
  console.log = (...values) => messages.push(values);
  console.debug = (...values) => messages.push(values);

  try {
    assert.equal(
      await callbacks.verify({ hash, password: `different-${"phrase".repeat(3)}` }),
      false,
    );
  } finally {
    console.log = originalLog;
    console.debug = originalDebug;
  }

  assert.deepEqual(messages, []);
});
