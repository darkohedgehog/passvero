import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("operator entry point emits only bounded diagnostics for invalid invocation/config access", () => {
  for (const args of [["SECRET_SENTINEL"], ["--config", "/nonexistent/SECRET_SENTINEL"]]) {
    const child = spawnSync(process.execPath, ["--import", "tsx", "scripts/produce-document-signature-health.ts", ...args], {
      cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: "test" }, encoding: "utf8", timeout: 10000,
    });
    assert.equal(child.status, 1);
    assert.equal(child.stderr, "");
    const value = JSON.parse(child.stdout);
    assert.deepEqual(Object.keys(value).sort(), ["durationMs", "phase", "reason", "result"]);
    assert.equal(value.result, "OPERATIONAL_FAILURE");
    assert.equal(value.reason, "UNKNOWN_FAILURE");
    assert.equal(value.phase, "CONFIGURATION");
    assert.ok(Number.isFinite(value.durationMs) && value.durationMs >= 0);
    assert.ok(!child.stdout.includes("SECRET_SENTINEL"));
  }
});
