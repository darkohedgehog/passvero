import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = new URL("../prisma/migrations/20260908210000_correct_auth_abuse_last_failure_constraint/migration.sql", import.meta.url);
const expected = '"lastAttemptAt">="windowStartedAt"AND("lastFailureAt"ISNULLOR"lastFailureAt"<="lastAttemptAt")AND("blockedUntil"ISNULLOR"blockedUntil">="lastAttemptAt")AND"expiresAt">"lastAttemptAt"';
function expression(sql) {
  const match = sql.match(/(?:ADD )?CONSTRAINT "ck_auth_abuse_bucket_timestamp_order"\s+CHECK\s*\(/);
  assert.ok(match);
  const start = match.index + match[0].length;
  let depth = 1;
  for (let end = start; end < sql.length; end += 1) {
    if (sql[end] === "(") depth += 1;
    if (sql[end] === ")") depth -= 1;
    if (depth === 0) return sql.slice(start, end).replace(/\s/g, "");
  }
  assert.fail("Unclosed canonical CHECK");
}
test("forward migration and integration fixture enforce the exact historical-failure invariant", async () => {
  const sql = await readFile(migration, "utf8");
  const fixture = await readFile(new URL("./integration/auth-abuse-postgresql.test.ts", import.meta.url), "utf8");
  assert.equal(expression(sql), expected);
  assert.equal(expression(fixture), expected);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /DROP CONSTRAINT "ck_auth_abuse_bucket_timestamp_order";/);
  assert.match(sql, /COMMIT;/);
  assert.doesNotMatch(sql, /\b(?:UPDATE|INSERT|DELETE|NOT VALID|CREATE|TRIGGER)\b/);
  assert.equal((sql.match(/ALTER TABLE/g) ?? []).length, 2);
});
