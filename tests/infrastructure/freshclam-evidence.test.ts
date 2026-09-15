import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { clamTime, parseFreshclamEvidence, validateDaemonEvidence, type DiskArtifact } from "../../src/infrastructure/documents/freshclam-evidence";
const fixture = (name: string) => readFile(new URL(`../fixtures/signature-health/${name}.log`, import.meta.url), "utf8");
const disk = (daily = 28123): DiskArtifact[] => [
  { name: "main", version: 63, sha256: "a".repeat(64) },
  { name: "daily", version: daily, sha256: "b".repeat(64) },
  { name: "bytecode", version: 339, sha256: "c".repeat(64) },
];
test("real initial download grammar and exact completion time; not authenticity proof", async () => {
  const log = await fixture("initial-download");
  const completed = Date.UTC(2026, 8, 14, 16, 4, 54);
  assert.deepEqual(parseFreshclamEvidence(log, disk(), completed, "Europe/Zagreb"), { completedAt: completed, result: "UPDATED" });
  assert.throws(() => parseFreshclamEvidence(log, disk(), completed - 1, "Europe/Zagreb"));
  assert.throws(() => parseFreshclamEvidence(log, disk(), completed + 86400000, "Europe/Zagreb"));
  assert.equal(parseFreshclamEvidence(log, disk(), completed + 86399999, "Europe/Zagreb").completedAt, completed);
  assert.throws(() => parseFreshclamEvidence(log.split("\n").slice(0, -2).join("\n") + "\n", disk(), completed, "Europe/Zagreb"));
});
test("real incremental excerpt requires missing trusted history; assembled scenario checks grammar only", async () => {
  const incremental = await fixture("incremental"), initial = await fixture("initial-download");
  const now = Date.UTC(2026, 8, 15, 8, 6);
  assert.throws(() => parseFreshclamEvidence(incremental, disk(28124), now, "Europe/Zagreb"));
  // Artificial splice: positive local grammar coverage, not a continuous real capture.
  assert.deepEqual(parseFreshclamEvidence(initial + incremental, disk(28124), now, "Europe/Zagreb"), {
    completedAt: Date.UTC(2026, 8, 15, 8, 5, 11), result: "ALREADY_CURRENT",
  });
  for (const bad of [initial + incremental.replace("local version: 28123", "local version: 28122"),
    initial + incremental + "Tue Sep 15 10:06:00 2026 -> ERROR: synthetic failure\n",
    initial + initial, incremental.replace("main.cvd", "daily.cvd")]) {
    assert.throws(() => parseFreshclamEvidence(bad, disk(28124), now, "Europe/Zagreb"));
  }
});
test("explicit timezone normalizes winter/summer and rejects DST fold, gap, invalid date and weekday", () => {
  assert.equal(clamTime("Tue Sep 15 09:05:11 2026", "Europe/Zagreb"), Date.UTC(2026, 8, 15, 7, 5, 11));
  assert.equal(clamTime("Thu Jan 15 09:05:11 2026", "Europe/Zagreb"), Date.UTC(2026, 0, 15, 8, 5, 11));
  for (const value of ["Sun Mar 29 02:30:00 2026", "Sun Oct 25 02:30:00 2026", "Tue Feb 31 09:05:11 2026", "Mon Sep 15 09:05:11 2026"]) assert.throws(() => clamTime(value, "Europe/Zagreb"));
});
test("selected real reload lifecycle; synthetic unresolved/unknown errors and incomplete activation reject", async () => {
  const log = await fixture("daemon-reload-excerpt"), now = Date.UTC(2026, 8, 15, 8);
  validateDaemonEvidence(log, now, "Europe/Zagreb");
  const error = "Mon Sep 14 18:07:03 2026 -> ERROR: Not listening on any interfaces\n";
  validateDaemonEvidence(error + log, now, "Europe/Zagreb");
  assert.throws(() => validateDaemonEvidence(error, now, "Europe/Zagreb"));
  assert.throws(() => validateDaemonEvidence(error.replace("Not listening on any interfaces", "synthetic unknown error") + log, now, "Europe/Zagreb"));
  assert.throws(() => validateDaemonEvidence(log.replace(/.*Activating.*\n/, ""), now, "Europe/Zagreb"));
  assert.throws(() => validateDaemonEvidence(log + "Tue Sep 15 09:11:00 2026 -> WARNING: synthetic validation failure\n", now, "Europe/Zagreb"));
});
