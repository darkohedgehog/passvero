import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

interface ClusterObservation {
  readonly database: string;
  readonly user: string;
  readonly port: number;
  readonly dataDirectory: string;
  readonly socketDirectories: string;
  readonly systemIdentifier: string;
  readonly sentinelHash: string;
}

function protectedLine(filePath: string): string {
  const status = lstatSync(filePath);
  assert.equal(status.isSymbolicLink(), false, "identity file must not be a symlink");
  assert.equal(status.mode & 0o777, 0o600, "identity file must be mode 0600");
  const value = readFileSync(filePath, "utf8");
  assert.ok(value.length > 0 && !value.includes("\n") && !value.includes("\r"));
  return value;
}

export function validateClusterIdentity(
  observation: ClusterObservation,
  expected: {
    readonly database: string;
    readonly user: string;
    readonly dataDirectory: string;
    readonly socketDirectory: string;
    readonly sentinelHash: string;
  },
): { readonly systemIdentifierHash: string } {
  assert.equal(observation.database, expected.database, "STOP_CLUSTER_IDENTITY: database mismatch");
  assert.equal(observation.user, expected.user, "STOP_CLUSTER_IDENTITY: role mismatch");
  assert.equal(observation.port, 55432, "STOP_CLUSTER_IDENTITY: port mismatch");
  assert.equal(realpathSync(observation.dataDirectory), realpathSync(expected.dataDirectory), "STOP_CLUSTER_IDENTITY: data directory mismatch");
  assert.equal(observation.socketDirectories, expected.socketDirectory, "STOP_CLUSTER_IDENTITY: socket mismatch");
  assert.equal(observation.sentinelHash, expected.sentinelHash, "STOP_CLUSTER_IDENTITY: sentinel mismatch");
  assert.match(observation.systemIdentifier, /^\d+$/, "STOP_CLUSTER_IDENTITY: system identifier format");
  return { systemIdentifierHash: createHash("sha256").update(observation.systemIdentifier).digest("hex") };
}

test("cluster identity validator rejects every mismatched authority anchor", () => {
  const expected = {
    database: "pvproof_test_012345abcdef",
    user: "pvproof_app_fedcba543210",
    dataDirectory: realpathSync("/private/tmp"),
    socketDirectory: "/private/tmp/passvero-stage13a-pg.fixture/socket",
    sentinelHash: "a".repeat(64),
  };
  const observation: ClusterObservation = {
    ...expected,
    port: 55432,
    systemIdentifier: "123456789",
    socketDirectories: expected.socketDirectory,
  };
  assert.match(validateClusterIdentity(observation, expected).systemIdentifierHash, /^[a-f0-9]{64}$/);
  assert.throws(() => validateClusterIdentity({ ...observation, port: 55433 }, expected), /STOP_CLUSTER_IDENTITY/);
  assert.throws(() => validateClusterIdentity({ ...observation, sentinelHash: "b".repeat(64) }, expected), /STOP_CLUSTER_IDENTITY/);
  assert.throws(() => validateClusterIdentity({ ...observation, database: "pvproof_test_wrong" }, expected), /database mismatch/);
  assert.throws(() => validateClusterIdentity({ ...observation, user: "pvproof_app_wrong" }, expected), /role mismatch/);
  assert.throws(() => validateClusterIdentity({ ...observation, dataDirectory: realpathSync("/") }, expected), /data directory mismatch/);
  assert.throws(() => validateClusterIdentity({ ...observation, socketDirectories: "/private/tmp/wrong-socket" }, expected), /socket mismatch/);
  assert.throws(() => validateClusterIdentity({ ...observation, systemIdentifier: "not-a-system-id" }, expected), /system identifier format/);
});

test("live disposable cluster identity is proven before schema application", {
  skip: process.env.PASSVERO_PROOF_CLUSTER_IDENTITY !== "1",
}, async () => {
  const identity = readRunIdentity();
  const expectedHash = protectedLine(path.join(identity.runRoot, "identity", "run-id-hash"));
  const client = new pg.Client({ connectionString: buildConnectionString(identity) });
  await client.connect();
  try {
    const result = await client.query<{
      database: string;
      user: string;
      port: number;
      data_directory: string;
      socket_directories: string;
      system_identifier: string;
      sentinel_hash: string;
    }>(`SELECT current_database() AS database,
      current_user AS user,
      inet_server_port() AS port,
      current_setting('data_directory') AS data_directory,
      current_setting('unix_socket_directories') AS socket_directories,
      (pg_control_system()).system_identifier::text AS system_identifier,
      (SELECT run_id_hash FROM passvero_stage13a_proof_sentinel) AS sentinel_hash`);
    assert.equal(result.rowCount, 1, "STOP_CLUSTER_IDENTITY: expected one identity row");
    const row = result.rows[0];
    const validated = validateClusterIdentity({
      database: row.database,
      user: row.user,
      port: Number(row.port),
      dataDirectory: row.data_directory,
      socketDirectories: row.socket_directories,
      systemIdentifier: row.system_identifier,
      sentinelHash: row.sentinel_hash,
    }, {
      database: identity.database,
      user: identity.applicationRole,
      dataDirectory: path.join(identity.runRoot, "data"),
      socketDirectory: identity.socketDir,
      sentinelHash: expectedHash,
    });
    await writeFile(path.join(identity.runRoot, "identity", "system-identifier-hash"), validated.systemIdentifierHash, { mode: 0o600, flag: "wx" });
    console.log("CLUSTER_IDENTITY=PASS");
  } finally {
    await client.end();
  }
});
