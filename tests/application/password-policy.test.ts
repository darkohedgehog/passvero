import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePasswordPolicy,
  withAcceptedPassword,
} from "../../src/application/auth/password-policy";

const safe15 = "safe passphrase!";

test("enforces the 15 through 128 Unicode code-point boundary", async () => {
  assert.deepEqual(await evaluatePasswordPolicy({ password: "a".repeat(14) }), {
    accepted: false,
    reason: "TOO_SHORT",
  });
  assert.deepEqual(await evaluatePasswordPolicy({ password: safe15 }), {
    accepted: true,
  });
  assert.deepEqual(await evaluatePasswordPolicy({ password: "x".repeat(128) }), {
    accepted: true,
  });
  assert.deepEqual(await evaluatePasswordPolicy({ password: "x".repeat(129) }), {
    accepted: false,
    reason: "TOO_LONG",
  });
});

test("counts supplementary-plane characters as code points rather than UTF-16 units", async () => {
  assert.deepEqual(await evaluatePasswordPolicy({ password: "🛡️".repeat(4) }), {
    accepted: false,
    reason: "TOO_SHORT",
  });
  assert.deepEqual(await evaluatePasswordPolicy({ password: "😀".repeat(15) }), {
    accepted: true,
  });
});

test("preserves spaces and never trims leading or trailing whitespace", async () => {
  const candidates = [
    "safe phrase words",
    "  leading spaces password",
    "trailing spaces password  ",
  ];

  for (const password of candidates) {
    let prepared = "";
    const result = await withAcceptedPassword(
      { password },
      async (acceptedPassword) => {
        prepared = acceptedPassword;
        return acceptedPassword;
      },
    );

    assert.deepEqual(result, { accepted: true });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(password));
    assert.equal(prepared, password);
  }
});

test("normalizes to NFC exactly without applying NFKC", async () => {
  const decomposed = `Cafe\u0301-${"z".repeat(10)}`;
  const composed = `Caf\u00e9-${"z".repeat(10)}`;
  const fullWidth = "Ａ".repeat(15);
  const prepared: string[] = [];

  for (const password of [decomposed, composed, fullWidth]) {
    const result = await withAcceptedPassword({ password }, async (value) => {
      prepared.push(value);
    });
    assert.deepEqual(result, { accepted: true });
  }

  assert.equal(prepared[0], composed);
  assert.equal(prepared[1], composed);
  assert.equal(prepared[2], fullWidth);
  assert.notEqual(prepared[2], fullWidth.normalize("NFKC"));
});

test("rechecks the code-point boundary after NFC normalization", async () => {
  const becomes14CodePoints = `e\u0301${"x".repeat(13)}`;

  assert.deepEqual(
    await evaluatePasswordPolicy({ password: becomes14CodePoints }),
    { accepted: false, reason: "TOO_SHORT" },
  );
});

test("rejects invalid, common, and Passvero-contextual passwords", async () => {
  assert.deepEqual(await evaluatePasswordPolicy({ password: 42 }), {
    accepted: false,
    reason: "INVALID_INPUT",
  });
  assert.deepEqual(
    await evaluatePasswordPolicy({
      password: `${"x".repeat(14)}${String.fromCharCode(0xd800)}`,
    }),
    { accepted: false, reason: "INVALID_INPUT" },
  );
  assert.deepEqual(
    await evaluatePasswordPolicy({ password: "correct horse battery staple" }),
    { accepted: false, reason: "COMMON_PASSWORD" },
  );
  assert.deepEqual(
    await evaluatePasswordPolicy({ password: "passvero-secure-password" }),
    { accepted: false, reason: "CONTEXTUAL_PASSWORD" },
  );
});

test("rejects exact email-local-part and display-name context when supplied", async () => {
  assert.deepEqual(
    await evaluatePasswordPolicy({
      password: "longaccountname",
      normalizedEmail: "longaccountname@example.test",
    }),
    { accepted: false, reason: "CONTEXTUAL_PASSWORD" },
  );
  assert.deepEqual(
    await evaluatePasswordPolicy({
      password: "Alexandra Example",
      displayName: "Alexandra Example",
    }),
    { accepted: false, reason: "CONTEXTUAL_PASSWORD" },
  );
});

test("passes only a digest prefix to the optional compromise checker", async () => {
  const compromised = "exposed unique phrase 2026";
  const digest = {
    prefix: "ABCDE",
    suffix: "0123456789ABCDEF0123456789ABCDEF012",
  };
  const observed: unknown[] = [];
  const compromiseDigester = {
    async digest(preparedNfcPassword: string) {
      assert.equal(preparedNfcPassword, compromised);
      return digest;
    },
  };
  const compromiseChecker = {
    async getCompromisedSuffixes(digestPrefix: string) {
      observed.push(digestPrefix);
      return [digest.suffix];
    },
  };

  assert.deepEqual(
    await evaluatePasswordPolicy(
      { password: compromised },
      { compromiseDigester, compromiseChecker },
    ),
    { accepted: false, reason: "COMPROMISED_PASSWORD" },
  );
  assert.deepEqual(observed, [digest.prefix]);
  assert.doesNotMatch(JSON.stringify(observed), new RegExp(compromised));
});

test("fails closed when only half of the optional compromise boundary is configured", async () => {
  assert.deepEqual(
    await evaluatePasswordPolicy(
      { password: "unexposed unique phrase 2026" },
      { compromiseChecker: { async getCompromisedSuffixes() { return []; } } },
    ),
    { accepted: false, reason: "COMPROMISED_PASSWORD" },
  );
});

test("rejects the built-in local compromised-password set by default", async () => {
  assert.deepEqual(
    await evaluatePasswordPolicy({ password: "123456789012345" }),
    { accepted: false, reason: "COMPROMISED_PASSWORD" },
  );
});

test("never serializes rejected password material", async () => {
  const raw = "passvero-private-password";
  const result = await evaluatePasswordPolicy({ password: raw });

  assert.doesNotMatch(JSON.stringify(result), new RegExp(raw));
  assert.deepEqual(Object.keys(result).sort(), ["accepted", "reason"]);
});
