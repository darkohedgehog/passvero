import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeAuthAccountIdentifier,
  normalizeTrustedClientNetwork,
} from "../../src/infrastructure/auth/auth-abuse-identifiers";

test("canonicalizes account identifiers with the approved trim, NFC, lowercase, and IDNA rules", () => {
  assert.equal(
    canonicalizeAuthAccountIdentifier("  U\u0308SER@BÜCHER.Example  "),
    "üser@xn--bcher-kva.example",
  );
});

test("rejects malformed account identifiers without echoing the supplied value", () => {
  const raw = "not-an-email-secret";

  assert.throws(
    () => canonicalizeAuthAccountIdentifier(raw),
    (error: unknown) => error instanceof Error
      && error.message === "Auth abuse account identifier is invalid."
      && !error.message.includes(raw),
  );
});

test("normalizes trusted IPv4 addresses to the approved /24 network", () => {
  assert.deepEqual(normalizeTrustedClientNetwork("203.0.113.197"), {
    addressFamily: "IPV4",
    networkKey: "203.0.113.0/24",
  });
  assert.deepEqual(normalizeTrustedClientNetwork("203.0.113.1"), {
    addressFamily: "IPV4",
    networkKey: "203.0.113.0/24",
  });
});

test("unmaps IPv4-mapped IPv6 before network bucketing", () => {
  assert.deepEqual(normalizeTrustedClientNetwork("::ffff:203.0.113.197"), {
    addressFamily: "IPV4",
    networkKey: "203.0.113.0/24",
  });
});

test("normalizes native IPv6 to RFC 5952 form on the approved /56 boundary", () => {
  assert.deepEqual(
    normalizeTrustedClientNetwork("2001:0db8:abcd:12ff:0000:0000:0000:0001"),
    {
      addressFamily: "IPV6",
      networkKey: "2001:db8:abcd:1200::/56",
    },
  );
  assert.deepEqual(
    normalizeTrustedClientNetwork("2001:db8:abcd:1201::99"),
    {
      addressFamily: "IPV6",
      networkKey: "2001:db8:abcd:1200::/56",
    },
  );
  assert.deepEqual(
    normalizeTrustedClientNetwork("2001:db8:abcd:1300::1"),
    {
      addressFamily: "IPV6",
      networkKey: "2001:db8:abcd:1300::/56",
    },
  );
});

test("rejects forwarded-header syntax, zones, whitespace, and missing trusted addresses", () => {
  for (const raw of [
    "203.0.113.1, 10.0.0.1",
    "for=203.0.113.1",
    "fe80::1%en0",
    " 203.0.113.1",
    "",
  ]) {
    assert.equal(normalizeTrustedClientNetwork(raw), null);
  }
  assert.equal(normalizeTrustedClientNetwork(undefined), null);
});
