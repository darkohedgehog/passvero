import assert from "node:assert/strict";
import test from "node:test";
import { parseCanonicalAppOrigin } from "../../src/application/config/canonical-app-origin";
import { canonicalProxyDenial, providerFacingHeaders } from "../../src/application/http/canonical-proxy";
import { createTrustedProxyVerifier, parseTrustedProxySecret } from "../../src/infrastructure/http/trusted-proxy";

// Deterministic test bytes only. Never an environment credential.
const token = Buffer.alloc(32, 7).toString("base64url");
const origin = "https://acceptance.example.test";
const verifyProxy = createTrustedProxyVerifier(origin, token);
function headers() {
  return new Headers({ host: "acceptance.example.test", "x-forwarded-host": "acceptance.example.test",
    "x-forwarded-proto": "https", "x-forwarded-port": "443", "x-passvero-proxy-token": token, origin });
}
function request(h = headers(), method = "POST", url = "http://127.0.0.1:3000/api/auth/sign-in") {
  return new Request(url, { method, headers: h });
}
const dependencies = { canonicalOrigin: origin, verifyProxy };

test("canonical origin parser preserves production/staging and normalizes default HTTPS port", () => {
  for (const candidate of ["https://passvero.eu", origin]) assert.equal(parseCanonicalAppOrigin(candidate), candidate);
  assert.equal(parseCanonicalAppOrigin(`${origin}:443/`), origin);
});
for (const value of [undefined, null, "", "bad", ` ${origin}`, `${origin} `, "http://passvero.eu", `${origin}:8443`,
  `${origin}/path`, `${origin}?a=b`, `${origin}#fragment`, "https://user:password@passvero.eu"]) {
  test(`canonical origin rejects invalid shape ${String(value)}`, () => {
    assert.throws(() => parseCanonicalAppOrigin(value), { name: "CanonicalOriginError" });
  });
}
test("proxy secret parser requires canonical 32-byte unpadded base64url", () => {
  assert.equal(parseTrustedProxySecret(token).length, 32);
  const noncanonical = token.slice(0, -1) + "d"; // Same decoded bytes, nonzero unused bits.
  for (const value of [undefined, "", token + "=", ` ${token}`, token + " ", token + "," + token,
    Buffer.alloc(31).toString("base64url"), Buffer.alloc(33).toString("base64url"), noncanonical, "!".repeat(43)]) {
    assert.throws(() => parseTrustedProxySecret(value), { name: "TrustedProxyConfigError" });
    assert.throws(() => createTrustedProxyVerifier(origin, value), /Trusted request configuration is invalid/);
  }
});
test("authentic proxy evidence accepts an internal URL without changing it", () => {
  const r = request();
  assert.equal(canonicalProxyDenial(r, dependencies, "DENIED"), null);
  assert.equal(r.url, "http://127.0.0.1:3000/api/auth/sign-in");
});
for (const name of ["host", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "x-passvero-proxy-token"]) {
  for (const variant of ["missing", "wrong", "list"]) {
    test(`${name} ${variant} is denied`, async () => {
      const h = headers();
      if (variant === "missing") h.delete(name);
      else h.set(name, variant === "wrong" ? "attacker.invalid" : `${h.get(name)},${h.get(name)}`);
      const response = canonicalProxyDenial(request(h), dependencies, "DENIED");
      assert.equal(response?.status, 403);
      assert.deepEqual(await response?.json(), { status: "DENIED" });
    });
  }
}
for (const [name, values] of Object.entries({ host: ["acceptance.example.test.", "ACCEPTANCE.example.test", "127.0.0.1", "acceptance.example.test:443"],
  "x-forwarded-host": ["acceptance.example.test.", "ACCEPTANCE.example.test"], "x-forwarded-proto": ["http", "HTTPS"],
  "x-forwarded-port": ["3000", "0443"], "x-passvero-proxy-token": [Buffer.alloc(32, 8).toString("base64url")] })) {
  for (const value of values) test(`reject alternate ${name} ${value === token ? "token" : value}`, () => {
    const h = headers(); h.set(name, value);
    assert.equal(canonicalProxyDenial(request(h), dependencies, "FORBIDDEN")?.status, 403);
  });
}
test("direct backend cannot bypass provenance through matching request.url or forged public headers", () => {
  const h = headers(); h.delete("x-passvero-proxy-token");
  for (const url of [origin + "/api/auth/sign-in", "http://127.0.0.1:3000/api/auth/sign-in"]) {
    assert.equal(canonicalProxyDenial(request(h, "POST", url), dependencies, "DENIED")?.status, 403);
  }
});
test("mutation browser Origin must be present and exact", () => {
  for (const value of [null, "null", "https://wrong.example.test", origin + "," + origin]) {
    const h = headers(); if (value === null) h.delete("origin"); else h.set("origin", value);
    assert.equal(canonicalProxyDenial(request(h), dependencies, "DENIED")?.status, 403);
  }
});
test("verification GET allows absent or exact Origin only after proxy validation", () => {
  for (const value of [null, origin]) {
    const h = headers(); if (value === null) h.delete("origin");
    assert.equal(canonicalProxyDenial(request(h, "GET"), dependencies, "DENIED", true), null);
    h.delete("x-passvero-proxy-token");
    assert.equal(canonicalProxyDenial(request(h, "GET"), dependencies, "DENIED", true)?.status, 403);
  }
  const h = headers(); h.set("origin", "https://wrong.example.test");
  assert.equal(canonicalProxyDenial(request(h, "GET"), dependencies, "DENIED", true)?.status, 403);
});
test("missing proxy configuration becomes a sanitized operational failure", async () => {
  const response = canonicalProxyDenial(request(), { canonicalOrigin: origin,
    verifyProxy: h => createTrustedProxyVerifier(origin, undefined)(h) }, "DENIED");
  assert.equal(response?.status, 503);
  assert.deepEqual(await response?.json(), { status: "OPERATIONAL_FAILURE" });
});
test("provider headers remove private evidence without mutating original cookies or Origin", () => {
  const h = headers(); h.set("cookie", "session=fixture");
  const sanitized = providerFacingHeaders(h);
  assert.equal(sanitized.has("x-passvero-proxy-token"), false);
  assert.equal(sanitized.get("cookie"), "session=fixture");
  assert.equal(sanitized.get("origin"), origin);
  assert.equal(h.get("x-passvero-proxy-token"), token);
});

test("canonical parser rejects URL syntax that hides a path or empty query/fragment during normalization", () => {
  for (const value of [origin + "?", origin + "#", origin + "/segment/..", "https:\\acceptance.example.test", "https://acceptance.\nexample.test"]) {
    assert.throws(() => parseCanonicalAppOrigin(value));
  }
});
