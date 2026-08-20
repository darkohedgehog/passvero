import test from "node:test";
import assert from "node:assert/strict";
import { lstatSync, readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bootstrapRunRoot,
  buildConnectionString,
  prepareCleanupEvidence,
  PROOF_ROOT_SENTINEL,
  readAuthSecret,
  readRunIdentity,
  selectCleanupEvidenceCandidate,
  validateGeneratedSql,
  validateDisposableHarnessEnvironment,
} from "../src/run-root.js";
import { renderEvidenceJson, type ProofEvidence } from "../src/evidence.js";
import { publishEvidenceState } from "../src/publication.mjs";

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

const REQUIRED_HYPOTHESIS_IDS = [
  "H1_NATIVE_TRANSACTION", "H2_DIRECT_API_OUTER_TRANSACTION", "H3_HANDLER_CONTEXT_REPLACEMENT",
  "H4_CONTROLLED_ACTIVATION", "H5_SESSION_COOKIE_AFTER_COMMIT", "H6_RECOVERY_AND_REVOCATION",
  "H7_ROUTE_EXPOSURE",
] as const;

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

async function withSyntheticRunRoot(
  action: (runRoot: string) => Promise<void> | void,
): Promise<void> {
  const previous = process.env.PASSVERO_PROOF_RUN_ROOT;
  const runRoot = await createSyntheticRunRoot();
  try {
    process.env.PASSVERO_PROOF_RUN_ROOT = runRoot;
    await action(runRoot);
  } finally {
    if (previous === undefined) delete process.env.PASSVERO_PROOF_RUN_ROOT;
    else process.env.PASSVERO_PROOF_RUN_ROOT = previous;
    await rm(runRoot, { recursive: true });
  }
}

async function createSyntheticHarnessRoot(): Promise<string> {
  const harnessRoot = await mkdtemp("/private/tmp/passvero-stage13a-harness.");
  await chmod(harnessRoot, 0o700);
  await mkdir(path.join(harnessRoot, "cache"), { mode: 0o700 });
  await mkdir(path.join(harnessRoot, "tmp"), { mode: 0o700 });
  await writeFile(path.join(harnessRoot, "npmrc"), "", { mode: 0o600 });
  return harnessRoot;
}

function setHarnessEnvironment(harnessRoot: string): void {
  process.env.XDG_CACHE_HOME = path.join(harnessRoot, "cache");
  process.env.npm_config_cache = path.join(harnessRoot, "cache");
  process.env.npm_config_userconfig = path.join(harnessRoot, "npmrc");
  process.env.TMPDIR = path.join(harnessRoot, "tmp");
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

function exactMandatoryEvidence(): ProofEvidence {
  const base = cleanEvidence();
  const hypothesis = base.hypotheses[0];
  return {
    ...base,
    hypotheses: REQUIRED_HYPOTHESIS_IDS.map((id) => ({ ...hypothesis, id, status: "PASS" })),
  };
}

test("static tool caches remain inside the disposable harness root", () => {
  const harnessRoot = process.cwd();
  assert.equal(process.env.HOME, undefined);
  assert.equal(process.env.XDG_CACHE_HOME, path.join(harnessRoot, "cache"));
  assert.equal(process.env.npm_config_cache, path.join(harnessRoot, "cache"));
  assert.equal(process.env.npm_config_userconfig, path.join(harnessRoot, "npmrc"));
  assert.equal(process.env.TMPDIR, path.join(harnessRoot, "tmp"));
  assert.equal(validateDisposableHarnessEnvironment(), harnessRoot);
});

test("disposable harness validation rejects lexical and filesystem escapes", async () => {
  const saved = {
    xdg: process.env.XDG_CACHE_HOME,
    npmCache: process.env.npm_config_cache,
    npmConfig: process.env.npm_config_userconfig,
    temp: process.env.TMPDIR,
  };
  const harnessRoot = await createSyntheticHarnessRoot();
  const symlinkPath = `${harnessRoot}link`;
  try {
    setHarnessEnvironment(harnessRoot);
    assert.equal(validateDisposableHarnessEnvironment(harnessRoot), harnessRoot);

    process.env.XDG_CACHE_HOME = "/private/tmp";
    assert.throws(() => validateDisposableHarnessEnvironment(harnessRoot), /STOP_RUN_ROOT_INVALID/);
    setHarnessEnvironment(harnessRoot);

    await chmod(harnessRoot, 0o755);
    assert.throws(() => validateDisposableHarnessEnvironment(harnessRoot), /mode must be 0700/);
    await chmod(harnessRoot, 0o700);

    await symlink(harnessRoot, symlinkPath);
    assert.throws(() => validateDisposableHarnessEnvironment(symlinkPath), /must not be a symlink/);
  } finally {
    await unlink(symlinkPath).catch(() => undefined);
    await rm(harnessRoot, { recursive: true });
    if (saved.xdg === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = saved.xdg;
    if (saved.npmCache === undefined) delete process.env.npm_config_cache;
    else process.env.npm_config_cache = saved.npmCache;
    if (saved.npmConfig === undefined) delete process.env.npm_config_userconfig;
    else process.env.npm_config_userconfig = saved.npmConfig;
    if (saved.temp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = saved.temp;
  }
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

test("bootstrap creates independent protected identities without shell secret handling", async () => {
  const runRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(runRoot, 0o700);
  try {
    await bootstrapRunRoot(runRoot);
    const identity = readFileSync(path.join(runRoot, ".passvero-stage13a-proof-root"), "utf8");
    assert.match(identity, new RegExp(`^${PROOF_ROOT_SENTINEL}:[A-Za-z0-9_-]{32}$`));
    const parsed = (() => {
      const previous = process.env.PASSVERO_PROOF_RUN_ROOT;
      try {
        process.env.PASSVERO_PROOF_RUN_ROOT = runRoot;
        return readRunIdentity();
      } finally {
        if (previous === undefined) delete process.env.PASSVERO_PROOF_RUN_ROOT;
        else process.env.PASSVERO_PROOF_RUN_ROOT = previous;
      }
    })();
    assert.notEqual(parsed.superuserRole.replace("pvproof_admin_", ""), parsed.applicationRole.replace("pvproof_app_", ""));
    assert.notEqual(parsed.superuserPassword, parsed.applicationPassword);
    assert.equal(parsed.superuserPassword.length, 48);
    assert.equal(parsed.applicationPassword.length, 48);
    for (const name of [".passvero-stage13a-proof-root", "identity/superuser-password", "identity/application-password", "identity/auth-secret"]) {
      const status = lstatSync(path.join(runRoot, name));
      assert.equal(status.mode & 0o777, 0o600);
      assert.equal(status.isSymbolicLink(), false);
    }
    await assert.rejects(() => bootstrapRunRoot(runRoot), /STOP_RUN_ROOT_INVALID|EEXIST/);
  } finally {
    await rm(runRoot, { recursive: true });
  }
});

test("generated SQL validator requires the exact quoted unqualified table set", () => {
  const names = [
    "User", "AuthIdentity", "AccountActivation", "AuthCredentialToken", "AuthAbuseBucket",
    "ProofMarker", "AuthProviderUser", "AuthProviderSession", "AuthProviderAccount",
    "AuthProviderVerification",
  ];
  const sql = names.map((name) => `CREATE TABLE "${name}" ("id" text);`).join("\n");
  assert.doesNotThrow(() => validateGeneratedSql(sql));
  assert.throws(() => validateGeneratedSql("SELECT 1;"), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(names.slice(1).map((name) => `CREATE TABLE "${name}" (id text);`).join("\n")), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(`${sql}\nCREATE TABLE "Unexpected" (id text);`), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', "CREATE TABLE User")), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE TABLE public."User"')), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE TABLE "public"."User"')), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE TABLE "AuthIdentity"')), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(`${sql}\nCREATE TEMP TABLE "Unexpected" (id text);`), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE TABLE IF NOT EXISTS "User"')), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(`${sql}\nCREATE/*hidden*/TABLE "Unexpected" (id text);`), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE/*hidden*/TABLE "AuthIdentity"')), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(`${sql}\nCREATE -- hidden\nTABLE "Unexpected" (id text);`), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE -- hidden\nTABLE "AuthIdentity"')), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(`${sql}\nCREATE\n-- CreateTable\nTABLE "Unexpected" (id text);`), /STOP_RUN_ROOT_INVALID/);
  assert.throws(() => validateGeneratedSql(sql.replace('CREATE TABLE "User"', 'CREATE\n-- CreateTable\nTABLE "AuthIdentity"')), /STOP_RUN_ROOT_INVALID/);
  assert.doesNotThrow(() => validateGeneratedSql(`-- CreateTable\n${sql}`));
});

test("cleanup evidence preparation rejects sensitive pending drafts before finalization", async () => {
  const runRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(runRoot, 0o700);
  const pendingPath = path.join(runRoot, "evidence.pending.json");
  const preparedPath = path.join(runRoot, ".cleanup-evidence-prepared");
  try {
    const { cleanup: _cleanup, ...pending } = cleanEvidence();
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, runRoot);
    assert.match(readFileSync(path.join(preparedPath, "pass-1111.json"), "utf8"), /"rootGone": true/);
    assert.match(readFileSync(path.join(preparedPath, "fail-1111.json"), "utf8"), /"status": "FAIL"/);
    assert.equal(readFileSync(path.join(preparedPath, "mandatory-verdict"), "utf8"), "FAIL");
    await rm(preparedPath, { recursive: true });

    await assert.rejects(
      () => prepareCleanupEvidence(pendingPath, path.join(runRoot, "inside-run-root-prepared"), runRoot),
      /prepared evidence path is not authoritative/,
    );

    await writeFile(pendingPath, JSON.stringify({ ...pending, passwordMaterial: "opaque" }), { mode: 0o600 });
    await assert.rejects(() => prepareCleanupEvidence(pendingPath, preparedPath, runRoot), /STOP_EVIDENCE_REDACTION/);
    await writeFile(pendingPath, JSON.stringify({ ...pending, assertions: ["__Host-session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax"] }), { mode: 0o600 });
    await assert.rejects(() => prepareCleanupEvidence(pendingPath, preparedPath, runRoot), /STOP_EVIDENCE_REDACTION/);
  } finally {
    await rm(runRoot, { recursive: true });
  }
});

test("proof failure remains authoritative FAIL even when cleanup is complete", () => {
  const complete = { serverStopped: true, listenerGone: true, pidGone: true, rootGone: true };
  assert.equal(selectCleanupEvidenceCandidate(0, true, complete), "pass-1111");
  assert.equal(selectCleanupEvidenceCandidate(0, false, complete), "fail-1111");
  assert.equal(selectCleanupEvidenceCandidate(1, true, complete), "fail-1111");
  assert.equal(selectCleanupEvidenceCandidate(73, true, complete), "fail-1111");
  assert.equal(selectCleanupEvidenceCandidate(0, true, { ...complete, rootGone: false }), "fail-1110");
  assert.throws(() => selectCleanupEvidenceCandidate(-1, true, complete), /STOP_RUN_ROOT_INVALID/);
});

test("mandatory verdict derivation requires the exact seven PASS hypotheses", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".cleanup-evidence-prepared");
  const exact = exactMandatoryEvidence();
  const { cleanup: _cleanup, ...exactPending } = exact;
  const variants = [
    { evidence: exactPending, verdict: "PASS" },
    { evidence: { ...exactPending, hypotheses: exactPending.hypotheses.map((item, index) => index === 3 ? { ...item, status: "FAIL" as const } : item) }, verdict: "FAIL" },
    { evidence: { ...exactPending, hypotheses: exactPending.hypotheses.slice(0, -1) }, verdict: "FAIL" },
    { evidence: { ...exactPending, hypotheses: [...exactPending.hypotheses.slice(0, -1), exactPending.hypotheses[0]] }, verdict: "FAIL" },
  ];
  try {
    for (const variant of variants) {
      await writeFile(pendingPath, JSON.stringify(variant.evidence), { mode: 0o600 });
      await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
      assert.equal(readFileSync(path.join(preparedPath, "mandatory-verdict"), "utf8"), variant.verdict);
      await rm(preparedPath, { recursive: true });
    }
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("pending retirement failure executes checked FAIL publication and discards PASS", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".cleanup-evidence-prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  try {
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    const result = await publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      retirePending: async () => { throw new Error("injected retirement failure"); },
    });
    assert.equal(result.passed, false);
    assert.equal(result.exitCode, 1);
    assert.equal(result.status, "FAIL_PENDING_RETAINED");
    assert.equal(result.authoritativeCandidate, "fail-1111");
    assert.equal(lstatSync(pendingPath).isFile(), true);
    const authoritative = JSON.parse(readFileSync(path.join(evidenceRoot, "evidence.json"), "utf8")) as { status: string };
    assert.equal(authoritative.status, "FAIL");
    assert.notEqual(authoritative.status, "PASS");
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("run-root rejects unsafe modes, symlinks, formats, port, and socket escape", async () => {
  await withSyntheticRunRoot(async (runRoot) => {
    await chmod(path.join(runRoot, "identity", "application-password"), 0o644);
    assert.throws(() => readRunIdentity(), /mode must be 0600/);
  });

  await withSyntheticRunRoot(async (runRoot) => {
    const rolePath = path.join(runRoot, "identity", "application-role");
    const targetPath = path.join(runRoot, "identity", "role-target");
    await writeFile(targetPath, "pvproof_app_012345abcdef", { mode: 0o600 });
    await unlink(rolePath);
    await symlink(targetPath, rolePath);
    assert.throws(() => readRunIdentity(), /non-symlink file/);
  });

  await withSyntheticRunRoot(async (runRoot) => {
    await chmod(runRoot, 0o755);
    assert.throws(() => readRunIdentity(), /mode must be 0700/);
  });

  await withSyntheticRunRoot(async (runRoot) => {
    await writeFile(path.join(runRoot, "identity", "superuser-role"), "pvproof_admin_nothex", { mode: 0o600 });
    assert.throws(() => readRunIdentity(), /superuser role is invalid/);
  });

  await withSyntheticRunRoot(async (runRoot) => {
    await writeFile(path.join(runRoot, "identity", "application-password"), "B".repeat(47), { mode: 0o600 });
    assert.throws(() => readRunIdentity(), /application credential is invalid/);
  });

  await withSyntheticRunRoot(async (runRoot) => {
    await writeFile(path.join(runRoot, "identity", "port"), "55433", { mode: 0o600 });
    assert.throws(() => readRunIdentity(), /port must be 55432/);
  });

  const outside = await mkdtemp("/private/tmp/passvero-stage13a-outside.");
  await chmod(outside, 0o700);
  try {
    await withSyntheticRunRoot(async (runRoot) => {
      await writeFile(path.join(runRoot, "identity", "socket-dir"), outside, { mode: 0o600 });
      assert.throws(() => readRunIdentity(), /socket directory must be directly inside run root/);
    });
  } finally {
    await rm(outside, { recursive: true });
  }

  await withSyntheticRunRoot(async (runRoot) => {
    await chmod(path.join(runRoot, "identity", "auth-secret"), 0o644);
    const identity = readRunIdentity();
    assert.throws(() => readAuthSecret(identity), /mode must be 0600/);
  });
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
  const serializedCookie = `${"__Host-session"}=${"opaque"}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  assert.throws(
    () => renderEvidenceJson({ ...evidence, assertions: [serializedCookie] }),
    /STOP_EVIDENCE_REDACTION/,
  );
});
