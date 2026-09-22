import assert from "node:assert/strict";
import test from "node:test";
import { accessRequestSchema } from "../../src/application/auth/access-request";
import { createAccessRequestTransport } from "../../src/application/auth/access-request-http";

const valid = { contactName: "Test Contact", email: " Person@Example.test ", organizationDisplayName: "Test Organization", locale: "hr" };
test("bounded strict request accepts supported locales and canonicalizes email", () => {
  for (const locale of ["hr", "en", "de", "sr", "sl", "pl"]) {
    assert.equal(accessRequestSchema.parse({ ...valid, locale }).email, "person@example.test");
  }
  for (const change of [{ contactName: " " }, { email: "bad" }, { locale: "xx" }, { role: "OWNER" }, { organizationDisplayName: "a".repeat(201) }, { contactName: "a\nB" }]) {
    assert.equal(accessRequestSchema.safeParse({ ...valid, ...change }).success, false);
  }
});

test("public transport returns no identity or request status, validates origin, size and abuse", async () => {
  let writes = 0;
  let blocked = false;
  let challenge = false;
  const post = createAccessRequestTransport({
    canonicalOrigin: "https://staging.example.test", verifyProxy: () => true,
    abuse: { async checkBeforeAttempt() { return blocked ? { status: "BLOCK", reasonCode: "TEMPORARILY_UNAVAILABLE", retryAfterSeconds: 60 } : challenge ? { status: "REQUIRE_TURNSTILE", reasonCode: "ADDITIONAL_VERIFICATION_REQUIRED" } : { status: "ALLOW" }; } },
    turnstileVerifier: { async verify() { return { valid: false }; } },
    async submit() { writes++; },
  });
  const request = (body: unknown, origin = "https://staging.example.test") => new Request(`${origin}/api/access-requests`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
  for (let i = 0; i < 2; i++) {
    const result = await post(request(valid));
    assert.equal(result.status, 202);
    assert.deepEqual(await result.json(), { status: "RECEIVED" });
  }
  assert.equal((await post(request(valid, "https://evil.test"))).status, 403);
  assert.equal((await post(request({ ...valid, email: "bad" }))).status, 400);
  assert.equal((await post(request({ payload: "x".repeat(9000) }))).status, 400);
  blocked = true;
  assert.equal((await post(request(valid))).status, 429);
  blocked = false; challenge = true;
  assert.equal((await post(request(valid))).status, 403);
  assert.equal(writes, 2);
});

test("operator command requires stable ID, explicit APPLY and bounded operator reference", async () => {
  const { parseAccessRequestCommand } = await import("../../src/application/auth/access-request-cli");
  const id = "d4597b86-fef5-4ad8-ac5a-6d8081fb43bd";
  assert.deepEqual(parseAccessRequestCommand(["list"]), { command: "list" });
  assert.equal(parseAccessRequestCommand(["approve", "--id", id, "--operator", "proof", "--confirm", "APPLY"]).command, "approve");
  for (const args of [["approve", "--id", id], ["approve", "--id", "email@example.test", "--operator", "proof", "--confirm", "APPLY"], ["list", "--role", "ADMIN"], ["show", "--id", id, "--id", id]]) assert.throws(() => parseAccessRequestCommand(args));
});

test("activation emails use canonical URLs and localized subjects in all six languages", async () => {
  const { renderAuthEmail } = await import("../../src/infrastructure/auth/auth-email-templates");
  const subjects = new Set<string>();
  for (const locale of ["hr", "en", "de", "sr", "sl", "pl"] as const) {
    const rendered = renderAuthEmail({ type: "CONTROLLED_ACTIVATION", recipient: "qa@example.test", locale, activationUrl: "https://staging.example.test/activate-account#capability=synthetic" }, "https://staging.example.test");
    subjects.add(rendered.subject);
    assert.ok(rendered.text.includes("72"));
    assert.throws(() => renderAuthEmail({ type: "CONTROLLED_ACTIVATION", recipient: "qa@example.test", locale, activationUrl: "https://evil.test/" }, "https://staging.example.test"));
  }
  assert.equal(subjects.size, 6);
});
