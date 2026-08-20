import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";
import { renderEvidenceJson, type ProofEvidence } from "../src/evidence.js";

const EMPTY_COUNTS = {
  providerUser: 0,
  providerAccount: 0,
  providerSession: 0,
  providerVerification: 0,
  canonicalUser: 0,
  authIdentity: 0,
  activation: 0,
  credentialToken: 0,
  abuseBucket: 0,
} as const;

async function createSyntheticRunRoot(): Promise<string> {
  const runRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(runRoot, 0o700);
  const identityDir = path.join(runRoot, "identity");
  const socketDir = path.join(runRoot, "socket");
  await mkdir(identityDir, { mode: 0o700 });
  await mkdir(socketDir, { mode: 0o700 });
  const suffix = "012345abcdef";
  const values = new Map([
    ["superuser-role", `pvproof_admin_${suffix}`],
    ["superuser-password", "A".repeat(48)],
    ["application-role", `pvproof_app_${suffix}`],
    ["application-password", "B".repeat(48)],
    ["database", `pvproof_test_${suffix}`],
    ["port", "55432"],
    ["socket-dir", socketDir],
    ["auth-secret", "C".repeat(48)],
  ]);
  await Promise.all(
    [...values].map(([name, value]) => writeFile(path.join(identityDir, name), value, { mode: 0o600 })),
  );
  return runRoot;
}

function cleanEvidence(): ProofEvidence {
  return {
    packageHashes: { betterAuth: "a".repeat(64) },
    clusterIdHash: "b".repeat(64),
    postgresVersionHash: "c".repeat(64),
    systemIdentifierHash: "d".repeat(64),
    hypotheses: [
      {
        id: "H2_DIRECT_API_OUTER_TRANSACTION",
        status: "PASS",
        transactionIds: ["e".repeat(64)],
        before: EMPTY_COUNTS,
        after: EMPTY_COUNTS,
        cookie: {
          present: false,
          nameHash: null,
          secure: false,
          httpOnly: false,
          sameSite: null,
          hostOnly: true,
          maxAgeSeconds: null,
        },
        assertions: ["outer rollback preserved"],
        failureCode: null,
      },
    ],
    cleanup: { listenerAbsent: true, rootRemoved: true },
    assertions: ["static contract only"],
  };
}

test("static tool caches remain inside the disposable harness root", () => {
  const harnessRoot = process.cwd();
  assert.equal(process.env.HOME, undefined);
  assert.equal(process.env.XDG_CACHE_HOME, path.join(harnessRoot, "cache"));
  assert.equal(process.env.npm_config_cache, path.join(harnessRoot, "cache"));
  assert.equal(process.env.npm_config_userconfig, path.join(harnessRoot, "npmrc"));
  assert.equal(process.env.TMPDIR, path.join(harnessRoot, "tmp"));
});

test("run-root identity fails closed and builds only an application connection", async () => {
  const previous = process.env.PASSVERO_PROOF_RUN_ROOT;
  const runRoot = await createSyntheticRunRoot();
  try {
    process.env.PASSVERO_PROOF_RUN_ROOT = runRoot;
    const identity = readRunIdentity();
    const connection = buildConnectionString(identity);
    assert.match(connection, /pvproof_app_012345abcdef/);
    assert.doesNotMatch(connection, /pvproof_admin_012345abcdef/);

    delete process.env.PASSVERO_PROOF_RUN_ROOT;
    assert.throws(() => readRunIdentity(), /STOP_RUN_ROOT_INVALID/);

    process.env.PASSVERO_PROOF_RUN_ROOT = path.join(runRoot, "missing");
    assert.throws(() => readRunIdentity(), /STOP_RUN_ROOT_INVALID/);
  } finally {
    if (previous === undefined) delete process.env.PASSVERO_PROOF_RUN_ROOT;
    else process.env.PASSVERO_PROOF_RUN_ROOT = previous;
    await rm(runRoot, { recursive: true });
  }
});

test("evidence rendering is deterministic and rejects sensitive shapes", () => {
  const evidence = cleanEvidence();
  const rendered = renderEvidenceJson(evidence);
  assert.equal(rendered, renderEvidenceJson(evidence));
  assert.match(rendered, /"credentialRecord": 0/);
  assert.doesNotMatch(rendered, /credentialToken/);
  assert.throws(
    () => renderEvidenceJson({ ...evidence, authSecret: "redacted" } as ProofEvidence),
    /STOP_EVIDENCE_REDACTION/,
  );
  const address = ["operator", "invalid.example"].join("@");
  assert.throws(
    () => renderEvidenceJson({ ...evidence, assertions: [address] }),
    /STOP_EVIDENCE_REDACTION/,
  );
});
