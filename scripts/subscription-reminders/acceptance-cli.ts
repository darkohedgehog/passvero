/** Runs as postgres via existing local peer socket; no email transport is imported. */
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createApprovedFixtures, appendApprovedRenewal, narrowApprovedScope, approvedSummary, resumeApprovedFixtures } from "./acceptance-fixtures";
import retained from "../../codex/evidence/subscription-reminders/operator-worker-diagnosis.json";
async function main() {
  assert.equal(process.argv.length, 3);
  const action = process.argv[2];
  assert.ok(["create", "resume", "renew", "narrow", "summary"].includes(action));
  const db = new PrismaClient({ adapter: new PrismaPg({ host: "/var/run/postgresql", port: 5433, database: "passvero_acceptance", user: "postgres", options: "-c lock_timeout=5000 -c statement_timeout=30000" }) });
  try {
    const scope = await db.$queryRaw<Array<{ database: string; port: string; directory: string }>>`SELECT current_database() AS database,current_setting('port') AS port,current_setting('data_directory') AS directory`;
    assert.deepEqual(scope, [{ database: "passvero_acceptance", port: "5433", directory: "/var/lib/postgresql/16/acceptance" }]);
    const result = action === "create" ? await createApprovedFixtures(db) : action === "resume" ? await resumeApprovedFixtures(db, retained.createdFixtureEvidence) : action === "renew" ? await appendApprovedRenewal(db) : action === "narrow" ? await narrowApprovedScope(db) : await approvedSummary(db);
    console.log(JSON.stringify({ action, result }));
  } finally { await db.$disconnect(); }
}
void main().catch(() => { console.error(JSON.stringify({ result: "STOP", reason: "APPROVED_FIXTURE_OPERATION_FAILED", retry: "MANUAL_REVIEW_REQUIRED" })); process.exitCode = 1; });
