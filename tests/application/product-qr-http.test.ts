import assert from "node:assert/strict";
import test from "node:test";
import { createProductQrHttpHandlers } from "../../src/application/products/qr/http";
import { ProductQrError } from "../../src/application/products/qr/errors";
import type { QrFailure } from "../../src/application/products/qr/contracts";
const origin = "https://passvero.eu", id = "11111111-1111-4111-8111-111111111111";
const context = { userId: "user", membershipId: "member", organizationId: "org", membershipRole: "ADMIN" as const, membershipStatus: "ACTIVE" as const, permissions: ["PRODUCT_READ" as const, "QRCODE_ACTIVATE" as const], correlationId: "correlation" };
function fixture(error?: unknown) {
  const calls: unknown[] = [];
  const handlers = createProductQrHttpHandlers({ verifyProxy: () => true, canonicalOrigin: origin,
    async resolveContext() { return { status: "RESOLVED", context, presentation: { organizationName: "Org" } }; },
    async activate(command, received) { calls.push({ command, received }); if (error) throw error; return { status: "ACTIVATED" }; },
    async render(query, received) { calls.push({ query, received }); if (error) throw error; return { body: new Uint8Array([1, 2]), contentType: query.format === "SVG" ? "image/svg+xml; charset=utf-8" : "image/png", filename: `passvero-AbCdEfGhIjKlMnOpQrStUv.${query.format.toLowerCase()}` }; },
  });
  return { calls, handlers };
}
function post(payload: unknown = { activationEvidence: "opaque" }, requestOrigin = origin, query = "") {
  return new Request(`${origin}/api/products/${id}/qr/activate${query}`, { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(payload) });
}
test("activation accepts only evidence and route product identity", async () => {
  const f = fixture(), response = await f.handlers.activate(post(), id);
  assert.deepEqual(await response.json(), { status: "ACTIVATED" });
  assert.deepEqual(f.calls, [{ command: { productId: id, activationEvidence: "opaque" }, received: context }]);
});
for (const key of ["organizationId", "passportId", "qrId", "code", "targetUrl", "publicCode", "productId", "productVersionId", "actorId", "activatedAt", "filename", "format"]) test(`rejects client authority: ${key}`, async () => {
  const f = fixture();
  assert.equal((await f.handlers.activate(post({ activationEvidence: "opaque", [key]: "injected" }), id)).status, 400);
  assert.equal(f.calls.length, 0);
});
test("rejects cross-origin, query authority, malformed or oversized bodies", async () => {
  for (const request of [post(undefined, "https://foreign.test"), post(undefined, origin, "?targetUrl=https://foreign.test"), post({ activationEvidence: "x".repeat(513) }), post({ activationEvidence: "" }), post([]), new Request(`${origin}/api/products/${id}/qr/activate`, { method: "POST", headers: { origin, "content-type": "text/plain" }, body: "x" })]) {
    const f = fixture(); assert.ok([400, 403].includes((await f.handlers.activate(request, id)).status)); assert.equal(f.calls.length, 0);
  }
});
for (const [format, preview] of [["SVG", false], ["PNG", false], ["SVG", true]] as const) test(`${format} preview=${preview} exact artifact headers`, async () => {
  const f = fixture();
  const response = await f.handlers.artifact(new Request(`${origin}/api/products/${id}/qr.svg`), id, format, preview);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), format === "SVG" ? "image/svg+xml; charset=utf-8" : "image/png");
  assert.equal(response.headers.get("content-disposition"), preview ? "inline" : `attachment; filename="passvero-AbCdEfGhIjKlMnOpQrStUv.${format.toLowerCase()}"`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-security-policy"), format === "SVG" ? "default-src 'none'; sandbox" : null);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2]);
});
for (const [status, code] of [["UNAUTHENTICATED", 401], ["FORBIDDEN", 403], ["NOT_FOUND", 404], ["VALIDATION", 400], ["STALE_WRITE", 409], ["INVALID_STATE", 409], ["NOT_ACTIVE", 409], ["OPERATIONAL_FAILURE", 500]] as const) test(`safe error ${status}`, async () => {
  const f = fixture(new ProductQrError(status as QrFailure));
  const response = await f.handlers.activate(post(), id);
  assert.equal(response.status, code); assert.deepEqual(await response.json(), { status });
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("unexpected error text and artifact query authority are never exposed", async () => {
  const f = fixture(new Error("Prisma secret targetUrl"));
  const response = await f.handlers.activate(post(), id);
  assert.deepEqual(await response.json(), { status: "OPERATIONAL_FAILURE" });
  const denied = await f.handlers.artifact(new Request(`${origin}/api/products/${id}/qr.svg?filename=x`), id, "SVG", false);
  assert.equal(denied.status, 400);
});

test("missing session returns safe 401 before any QR service invocation", async () => {
  const handlers = createProductQrHttpHandlers({ verifyProxy: () => true, canonicalOrigin: origin,
    async resolveContext() { return { status: "DENIED", reason: "NO_PROVIDER_SESSION" }; },
    async activate() { assert.fail("Unauthenticated activation"); },
    async render() { assert.fail("Unauthenticated artifact"); },
  });
  for (const response of [await handlers.activate(post(), id), await handlers.artifact(new Request(`${origin}/qr.svg`), id, "SVG", false)]) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { status: "UNAUTHENTICATED" });
  }
});
