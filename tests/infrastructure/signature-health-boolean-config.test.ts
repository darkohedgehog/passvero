import assert from "node:assert/strict";
import test from "node:test";
import { validateProducerBooleanConfiguration as validate } from "../../src/infrastructure/documents/signature-health-producer-io";

// Sanitized relevant directives captured from srv1834647 during the prior read-only
// trust-establishment feasibility check. No live access in this test. This proves
// config compatibility only, not database authenticity, writer continuity or readiness.
const actual = "TestDatabases yes\nBytecode true\nLogVerbose no\nLogTime true\n";
const on = ["yes", "true", "1", "YES", "TrUe"];
const off = ["no", "false", "0", "NO", "FaLsE"];
const replace = (key: string, value: string) => actual.replace(new RegExp(`^${key} .*$`, "m"), `${key} ${value}`);

test("actual sanitized Bytecode true configuration and previous Bytecode yes", () => {
  assert.doesNotThrow(() => validate(actual));
  assert.doesNotThrow(() => validate(replace("Bytecode", "yes")));
});
for (const key of ["TestDatabases", "Bytecode", "LogTime", "LogVerbose"]) {
  test(`${key}: supported boolean values preserve the required semantic value`, () => {
    for (const value of key === "LogVerbose" ? off : on) assert.doesNotThrow(() => validate(replace(key, value)));
    for (const value of key === "LogVerbose" ? on : off) assert.throws(() => validate(replace(key, value)), /CONFIGURATION_CHANGED/);
  });
  test(`${key}: missing, unknown, duplicated and conflicting values reject`, () => {
    for (const value of ["", "on", "off", "2", "01", "yes no", "true # note", '"true"', "null"]) {
      assert.throws(() => validate(replace(key, value)), /CONFIGURATION_CHANGED/);
    }
    assert.throws(() => validate(actual.replace(new RegExp(`^${key} .*\\n`, "m"), "")), /CONFIGURATION_CHANGED/);
    for (const value of ["true", "false"]) assert.throws(() => validate(actual + `${key} ${value}\n`), /CONFIGURATION_CHANGED/);
    assert.throws(() => validate(actual + `${key}\n`), /CONFIGURATION_CHANGED/);
  });
}
test("whitespace and whole-line comments do not bypass duplicate or unsupported-source checks", () => {
  assert.doesNotThrow(() => validate("# Bytecode false\n" + actual.replace("Bytecode true", "  Bytecode\ttrue  ")));
  assert.throws(() => validate(actual + "\tBytecode\tyes\n"), /CONFIGURATION_CHANGED/);
  for (const key of ["DatabaseCustomURL", "ExtraDatabase", "ExcludeDatabase", "PrivateMirror"]) {
    assert.throws(() => validate(actual + `${key} synthetic\n`), /CONFIGURATION_CHANGED/);
  }
});
