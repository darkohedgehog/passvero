import assert from "node:assert/strict";
import { test } from "node:test";
import { Socket } from "node:net";
import { responseObserver, runClient, type Outcome } from "../../scripts/document-scan-boundary/smoke-client";

test("local doubles preserve client first failure, expected result and NOT_RUN", async () => {
  const checks = await runClient({ validate: async () => "UNEXPECTED_VALID_RESPONSE", forbidden: async () => { throw Error("must not run"); } });
  assert.equal(checks[0].CHECK_ID, "CLIENT_VALID_PDF");
  assert.equal(checks[0].expected, "VALID");
  assert.equal(checks[0].actual, "UNEXPECTED_VALID_RESPONSE");
  assert.equal(checks[1].result, "NOT_RUN");
});

test("local success and thrown secrets produce only bounded normalized rows", async () => {
  const checks = await runClient({ validate: async () => "VALID", forbidden: async () => "REJECTED_REQUEST" });
  assert.ok(checks.every(row => row.result === "PASS"));
  const failed = await runClient({ validate: async () => { throw Error("SYNTHETIC_COOKIE_SECRET"); }, forbidden: async () => "REJECTED_REQUEST" });
  assert.equal(failed[0].actual, "INTERNAL_HARNESS_ERROR");
  assert.ok(!JSON.stringify(failed).includes("SYNTHETIC"));
  assert.ok(JSON.stringify(failed).length < 4096);
});

test("passive socket doubles distinguish response and transport categories without exposing raw bytes", () => {
  const cases: [string | undefined, string, Outcome][] = [
    [undefined, "FAILED", "INCOMPLETE_RESPONSE"],
    ["SECRET", "FAILED", "MALFORMED_RESPONSE"],
    ['{"kind":"FAILED"}', "FAILED", "REJECTED_REQUEST"],
    ['{"kind":"TIMEOUT"}', "TIMEOUT", "TIMEOUT"],
    ['{"kind":"TIMEOUT"}', "FAILED", "UNEXPECTED_VALID_RESPONSE"],
    ["x".repeat(1025), "FAILED", "MALFORMED_RESPONSE"],
  ];
  for (const [data, kind, expected] of cases) {
    const observer = responseObserver(); const socket = new Socket();
    observer.attach(socket);
    if (data) socket.emit("data", Buffer.from(data));
    assert.equal(observer.classify(kind), expected);
    socket.destroy();
  }
  const observer = responseObserver(); const socket = new Socket();
  observer.attach(socket); socket.emit("error", Error("SECRET"));
  assert.equal(observer.classify("FAILED"), "CONNECTION_FAILURE");
  socket.destroy();
});


test("normalized adapter result kind is retained separately from failure category", async () => {
  const checks = await runClient({ validate: async () => ({ outcome: "UNEXPECTED_VALID_RESPONSE", kind: "ENCRYPTED" }), forbidden: async () => "REJECTED_REQUEST" });
  assert.equal(checks[0].client_kind, "ENCRYPTED");
  assert.equal(checks[0].actual, "UNEXPECTED_VALID_RESPONSE");
  assert.equal(checks[1].result, "NOT_RUN");
  const observer = responseObserver(); const socket = new Socket();
  observer.attach(socket);
  socket.emit("data", Buffer.from(JSON.stringify({ kind: "VALID", identity: { sha256: "a".repeat(64), sizeBytes: 1 } })));
  assert.equal(observer.classify("VALID"), "VALID");
  assert.equal(observer.classify("FAILED"), "IDENTITY_FAILURE");
  socket.destroy();
});
