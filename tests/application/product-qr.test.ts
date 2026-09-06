import assert from "node:assert/strict";
import test from "node:test";
import { createProductQrServices } from "../../src/application/products/qr/services";
import { createQrEvidence } from "../../src/infrastructure/products/qr-evidence";
import { permissionsForMembershipRole } from "../../src/application/permissions/product-permissions";
import type { AuthenticatedUserContext, MembershipRole } from "../../src/application/context/authenticated-user-context";
import type { ProductQrDependencies, ProductQrRecord, QrRecord } from "../../src/application/products/qr/ports";

const productId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const at = new Date("2026-09-06T12:00:00.000Z");
const target = "https://passvero.eu/p/AbCdEfGhIjKlMnOpQrStUv";
export function qrFixture(role: MembershipRole = "ADMIN") {
  const context: AuthenticatedUserContext = { userId: "user", membershipId: "member", organizationId, membershipRole: role, membershipStatus: "ACTIVE", permissions: permissionsForMembershipRole(role), correlationId: "correlation" };
  let qr: QrRecord = { id: "qr", passportId: "passport", code: "INTERNAL_CODE", targetUrl: target, status: "PENDING", generatedAt: at, createdAt: at, updatedAt: at, activatedAt: null, revokedAt: null };
  let record: ProductQrRecord | null = { id: productId, organizationId, publicCode: "AbCdEfGhIjKlMnOpQrStUv", lifecycleStatus: "ACTIVE", currentPublishedVersionId: "version", version: { id: "version", productId, organizationId, status: "PUBLISHED", sourceLocale: "hr" }, passports: [{ id: "passport", productId, organizationId, status: "ACTIVE", qrCodes: [qr] }] };
  let eligibility = { membershipRole: role, membershipStatus: "ACTIVE" as "ACTIVE" | "SUSPENDED", organizationStatus: "ACTIVE" };
  let publicEligible = true, writes = 0, runs = 0, failWrite = false;
  const evidence = createQrEvidence("test-only-key-not-a-real-secret-1234567890");
  const rendered: string[] = [];
  const dependencies: ProductQrDependencies<object> = {
    canonicalOrigin: "https://passvero.eu", now: () => new Date(at.getTime() + 1000), evidence,
    transactionRunner: { async run(_mode, work) { runs++; return work({}); } },
    persistence: {
      async readEligibility() { return eligibility; },
      async readProduct(_tx, id, org) { assert.equal(id, productId); assert.equal(org, organizationId); return record; },
      async publicEligible(_tx, code, locale) { assert.equal(code, "AbCdEfGhIjKlMnOpQrStUv"); assert.equal(locale, "hr"); return publicEligible; },
      async activate(_tx, input) {
        writes++;
        assert.equal(input.context.organizationId, organizationId);
        assert.equal(input.qr.status, "PENDING");
        if (failWrite) throw new Error("private constraint details");
        qr = { ...qr, status: "ACTIVE", activatedAt: input.at, updatedAt: input.at };
        if (record) record = { ...record, passports: [{ ...record.passports[0], qrCodes: [qr] }] };
        return true;
      },
    },
    renderer: { async render(url) { rendered.push(url); return new Uint8Array([1, 2]); } },
  };
  return { context, dependencies, services: createProductQrServices(dependencies), evidence, rendered,
    get qr() { return qr; }, get record() { return record; }, get writes() { return writes; }, get runs() { return runs; },
    setRecord(value: ProductQrRecord | null) { record = value; },
    setQr(value: Partial<QrRecord>) { qr = { ...qr, ...value }; if (record) record = { ...record, passports: [{ ...record.passports[0], qrCodes: [qr] }] }; },
    setEligibility(value: Partial<typeof eligibility>) { eligibility = { ...eligibility, ...value }; },
    setPublic(value: boolean) { publicEligible = value; }, failWrite() { failWrite = true; },
  };
}
const failure = (status: string) => (error: unknown) => error instanceof Error && "status" in error && error.status === status && !error.message.includes("private");
for (const role of ["VIEWER", "EDITOR", "ADMIN", "OWNER"] as const) {
  test(`${role} can read and download; only ADMIN/OWNER activate`, async () => {
    const f = qrFixture(role);
    const projection = await f.services.get({ productId }, f.context);
    assert.equal(projection.kind, "QR");
    assert.ok(!JSON.stringify(projection).includes("INTERNAL_CODE"));
    assert.ok(!JSON.stringify(projection).includes("https:"));
    if (projection.kind !== "QR") return;
    assert.equal(projection.previewUrl, null);
    const allowed = role === "ADMIN" || role === "OWNER";
    assert.equal(projection.activationEvidence !== null, allowed);
    const command = { productId, activationEvidence: f.evidence.issue(f.qr) };
    if (allowed) assert.deepEqual(await f.services.activate(command, f.context), { status: "ACTIVATED" });
    else await assert.rejects(f.services.activate(command, f.context), failure("FORBIDDEN"));
    f.setQr({ status: "ACTIVE", activatedAt: new Date(at.getTime() + 1000), updatedAt: new Date(at.getTime() + 1000) });
    for (const format of ["SVG", "PNG"] as const) {
      const artifact = await f.services.render({ productId, format }, f.context);
      assert.equal(artifact.filename, `passvero-AbCdEfGhIjKlMnOpQrStUv.${format.toLowerCase()}`);
    }
    assert.deepEqual(f.rendered, [target, target]);
  });
}
test("fresh activation preserves identity and compatible pending/current replay never writes again", async () => {
  const f = qrFixture(), before = f.qr, old = f.evidence.issue(before);
  await f.services.activate({ productId, activationEvidence: old }, f.context);
  assert.deepEqual(f.qr, { ...before, status: "ACTIVE", activatedAt: new Date(at.getTime() + 1000), updatedAt: new Date(at.getTime() + 1000) });
  for (const token of [old, f.evidence.issue(f.qr)]) assert.deepEqual(await f.services.activate({ productId, activationEvidence: token }, f.context), { status: "NO_CHANGE" });
  assert.equal(f.writes, 1);
});
test("stale pending/current ACTIVE revisions and foreign identity fail without writes", async () => {
  for (const active of [false, true]) {
    const f = qrFixture();
    if (active) f.setQr({ status: "ACTIVE", activatedAt: at });
    const token = f.evidence.issue(f.qr);
    f.setQr({ updatedAt: new Date(at.getTime() + 1) });
    await assert.rejects(f.services.activate({ productId, activationEvidence: token }, f.context), failure("STALE_WRITE"));
    assert.equal(f.writes, 0);
  }
  const f = qrFixture();
  await assert.rejects(f.services.activate({ productId, activationEvidence: f.evidence.issue({ ...f.qr, id: "another" }) }, f.context), failure("STALE_WRITE"));
});
test("evidence is integrity protected, opaque and binds immutable fields and revision", () => {
  const f = qrFixture(), token = f.evidence.issue(f.qr);
  assert.ok(token.length < 512);
  assert.doesNotMatch(token, /INTERNAL_CODE|passport|2026|https/);
  assert.deepEqual(f.evidence.read(token), f.evidence.fingerprint(f.qr));
  for (const input of ["", token + "x", "x".repeat(513), token.replace(/^./, "x")]) assert.equal(f.evidence.read(input), null);
  assert.equal(createQrEvidence("another-test-only-key-123456789012345").read(token), null);
  for (const change of [{ id: "other" }, { passportId: "other" }, { code: "OTHER_CODE" }, { targetUrl: target + "x" }, { generatedAt: new Date(0) }]) assert.notEqual(f.evidence.fingerprint({ ...f.qr, ...change }).identity, f.evidence.fingerprint(f.qr).identity);
});
test("inactive identity and foreign products are denied", async () => {
  const f = qrFixture();
  await assert.rejects(f.services.get({ productId }, null), failure("UNAUTHENTICATED"));
  await assert.rejects(f.services.activate({ productId, activationEvidence: "x" }, null), failure("UNAUTHENTICATED"));
  await assert.rejects(f.services.render({ productId, format: "PNG" }, null), failure("UNAUTHENTICATED"));
  f.setEligibility({ membershipStatus: "SUSPENDED" });
  await assert.rejects(f.services.get({ productId }, f.context), failure("FORBIDDEN"));
  f.setEligibility({ membershipStatus: "ACTIVE", organizationStatus: "SUSPENDED" });
  await assert.rejects(f.services.get({ productId }, f.context), failure("FORBIDDEN"));
  f.setEligibility({ organizationStatus: "ACTIVE", membershipRole: "VIEWER" });
  await assert.rejects(f.services.activate({ productId, activationEvidence: f.evidence.issue(f.qr) }, f.context), failure("FORBIDDEN"));
  f.setRecord(null);
  await assert.rejects(f.services.get({ productId }, f.context), failure("NOT_FOUND"));
});
test("unpublished is distinct from missing/corrupt published QR", async () => {
  const f = qrFixture(), record = f.record!;
  f.setRecord({ ...record, currentPublishedVersionId: null, version: null, passports: [] });
  assert.deepEqual(await f.services.get({ productId }, f.context), { kind: "NOT_PUBLISHED" });
  for (const broken of [
    { ...record, passports: [] }, { ...record, passports: [record.passports[0], record.passports[0]] },
    { ...record, passports: [{ ...record.passports[0], qrCodes: [] }] },
    { ...record, passports: [{ ...record.passports[0], qrCodes: [f.qr, f.qr] }] },
    { ...record, organizationId: "foreign" },
    { ...record, passports: [{ ...record.passports[0], organizationId: "foreign" }] },
    { ...record, version: { ...record.version!, productId: "foreign" } },
    { ...record, version: { ...record.version!, status: "DRAFT" } },
  ]) {
    f.setRecord(broken);
    await assert.rejects(f.services.get({ productId }, f.context), failure("OPERATIONAL_FAILURE"));
  }
});
for (const change of [{ code: "bad" }, { targetUrl: target + "?lang=hr" }, { passportId: "wrong" }, { status: "ACTIVE" as const }]) {
  test(`QR corruption fails closed: ${Object.keys(change)[0]}`, async () => {
    const f = qrFixture(); f.setQr(change);
    await assert.rejects(f.services.get({ productId }, f.context), failure("OPERATIONAL_FAILURE"));
    assert.equal(f.writes, 0);
  });
}
for (const status of ["PENDING", "REVOKED"] as const) test(`${status} artifacts denied`, async () => {
  const f = qrFixture();
  if (status === "REVOKED") f.setQr({ status, activatedAt: at, revokedAt: at });
  for (const format of ["SVG", "PNG"] as const) await assert.rejects(f.services.render({ productId, format }, f.context), failure("NOT_ACTIVE"));
  if (status === "REVOKED") await assert.rejects(f.services.activate({ productId, activationEvidence: f.evidence.issue(f.qr) }, f.context), failure("INVALID_STATE"));
  assert.equal(f.rendered.length, 0);
});
for (const status of ["WITHDRAWN", "ARCHIVED"] as const) test(`${status} Passport shows status but no actions`, async () => {
  const f = qrFixture(); f.setQr({ status: "ACTIVE", activatedAt: at });
  f.setRecord({ ...f.record!, passports: [{ ...f.record!.passports[0], status }] });
  const projection = await f.services.get({ productId }, f.context);
  assert.deepEqual(projection, { kind: "QR", status: "ACTIVE", activationEvidence: null, previewUrl: null, downloadSvgUrl: null, downloadPngUrl: null });
  await assert.rejects(f.services.render({ productId, format: "SVG" }, f.context), failure("INVALID_STATE"));
  await assert.rejects(f.services.activate({ productId, activationEvidence: f.evidence.issue(f.qr) }, f.context), failure("INVALID_STATE"));
});
test("archived Product and locally unavailable public DPP deny artifacts", async () => {
  const f = qrFixture(); f.setQr({ status: "ACTIVE", activatedAt: at });
  f.setRecord({ ...f.record!, lifecycleStatus: "ARCHIVED" });
  await assert.rejects(f.services.render({ productId, format: "SVG" }, f.context), failure("INVALID_STATE"));
  f.setRecord({ ...f.record!, lifecycleStatus: "ACTIVE" }); f.setPublic(false);
  await assert.rejects(f.services.get({ productId }, f.context), failure("OPERATIONAL_FAILURE"));
});
test("operational failure is sanitized and never automatically retried", async () => {
  const f = qrFixture(); f.failWrite();
  await assert.rejects(f.services.activate({ productId, activationEvidence: f.evidence.issue(f.qr) }, f.context), failure("OPERATIONAL_FAILURE"));
  assert.equal(f.runs, 1); assert.equal(f.writes, 1); assert.equal(f.qr.status, "PENDING");
});
test("publication version changes preserve QR evidence and artifact payload", async () => {
  const f = qrFixture(); f.setQr({ status: "ACTIVE", activatedAt: at });
  const token = f.evidence.issue(f.qr);
  await f.services.render({ productId, format: "SVG" }, f.context);
  f.setRecord({ ...f.record!, currentPublishedVersionId: "next", version: { ...f.record!.version!, id: "next" } });
  await f.services.render({ productId, format: "PNG" }, f.context);
  assert.equal(f.evidence.issue(f.qr), token); assert.deepEqual(f.rendered, [target, target]); assert.equal(f.writes, 0);
});
