import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bootstrapRunRoot,
  aggregateProofEvidence,
  buildConnectionString,
  prepareCleanupEvidence,
  PROOF_ROOT_SENTINEL,
  readAuthSecret,
  readRunIdentity,
  recordHypothesisProcessFailure,
  selectCleanupEvidenceCandidate,
  validateRecordedHypothesisResult,
  validateGeneratedSql,
  validateDisposableHarnessEnvironment,
  writeHypothesisAssertionResult,
  writeHypothesisResult,
} from "../src/run-root.js";
import {
  aggregateHypothesisProcessResults,
  deltaRowCounts,
  HYPOTHESIS_ASSERTION_CODES,
  HYPOTHESIS_FAILURE_CODES,
  mandatoryHypothesesPassed,
  parseHypothesisAssertionResult,
  parseHypothesisResult,
  renderEvidenceJson,
  renderPendingEvidenceJson,
  REQUIRED_HYPOTHESIS_IDS as PROOF_HYPOTHESIS_IDS,
  type HypothesisAssertionResult,
  type HypothesisFailureResult,
  type ProofEvidence,
} from "../src/evidence.js";
import { claimEvidenceAttempt, finalizeEvidenceAttempt, publishEvidenceState } from "../src/publication.mjs";
import { planCleanup, type ProofPhase } from "../src/lifecycle.js";

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
  const fragmentsDir = path.join(runRoot, "evidence-fragments");
  const failuresDir = path.join(runRoot, "process-failures");
  const harnessDir = path.join(runRoot, "harness");
  const dataDir = path.join(runRoot, "data");
  await mkdir(identityDir, { mode: 0o700 });
  await mkdir(socketDir, { mode: 0o700 });
  await mkdir(fragmentsDir, { mode: 0o700 });
  await mkdir(failuresDir, { mode: 0o700 });
  await mkdir(path.join(harnessDir, "node_modules", "better-auth"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(harnessDir, "node_modules", "@better-auth", "core"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(harnessDir, "node_modules", "@better-auth", "prisma-adapter"), { recursive: true, mode: 0o700 });
  await chmod(harnessDir, 0o700);
  await mkdir(dataDir, { mode: 0o700 });
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
    ["run-id-hash", "D".repeat(64)],
    ["system-identifier-hash", "E".repeat(64)],
  ]);
  await Promise.all(
    [...values].map(([name, value]) => writeFile(path.join(identityDir, name), value, { mode: 0o600 })),
  );
  await Promise.all([
    writeFile(path.join(harnessDir, "package-lock.json"), "{}\n", { mode: 0o600 }),
    writeFile(path.join(harnessDir, "node_modules", "better-auth", "package.json"), "{}\n", { mode: 0o600 }),
    writeFile(path.join(harnessDir, "node_modules", "@better-auth", "core", "package.json"), "{}\n", { mode: 0o600 }),
    writeFile(path.join(harnessDir, "node_modules", "@better-auth", "prisma-adapter", "package.json"), "{}\n", { mode: 0o600 }),
    writeFile(path.join(dataDir, "PG_VERSION"), "16\n", { mode: 0o600 }),
  ]);
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
        deltas: EMPTY_COUNTS,
        cookie: {
          present: false,
          nameHash: null,
          secure: false,
          httpOnly: false,
          sameSite: null,
          hostOnly: true,
          maxAgeSeconds: null,
        },
        assertions: ["H2_DIRECT_BOUNDARY_ASSERTIONS_COMPLETE"],
        failureCode: null,
      },
    ],
    cleanup: { listenerAbsent: true, rootRemoved: true },
    assertions: ["static contract only"],
  };
}

function exactMandatoryEvidence(): ProofEvidence {
  const base = cleanEvidence();
  return {
    ...base,
    hypotheses: REQUIRED_HYPOTHESIS_IDS.map((id) => assertionResult(id)),
  };
}

function assertionResult(
  id: (typeof REQUIRED_HYPOTHESIS_IDS)[number],
  overrides: Partial<HypothesisAssertionResult> = {},
): HypothesisAssertionResult {
  const before = { ...EMPTY_COUNTS, providerUser: 2 };
  const after = { ...EMPTY_COUNTS, providerUser: 3, authIdentity: 1 };
  return {
    id,
    status: "PASS",
    transactionIds: ["e".repeat(64)],
    before,
    after,
    deltas: deltaRowCounts(before, after),
    cookie: {
      present: true,
      nameHash: "f".repeat(64),
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      hostOnly: true,
      maxAgeSeconds: 604800,
    },
    assertions: [...HYPOTHESIS_ASSERTION_CODES[id]],
    failureCode: null,
    ...overrides,
  };
}

function allPassAssertionResults(): readonly HypothesisAssertionResult[] {
  return PROOF_HYPOTHESIS_IDS.map((id) => assertionResult(id));
}

function failureResult(
  id: (typeof REQUIRED_HYPOTHESIS_IDS)[number],
): HypothesisFailureResult {
  const success = assertionResult(id);
  return {
    ...success,
    status: "FAIL",
    assertions: [],
    failureCode: HYPOTHESIS_FAILURE_CODES[id],
  };
}

test("process aggregation accepts exactly seven unique assertion-bound results", () => {
  const hypotheses = aggregateHypothesisProcessResults(allPassAssertionResults());
  assert.deepEqual(hypotheses.map(({ id }) => id), PROOF_HYPOTHESIS_IDS);
  assert.equal(hypotheses.every(({ status, failureCode }) => status === "PASS" && failureCode === null), true);
  assert.equal(mandatoryHypothesesPassed(hypotheses), true);
});

test("process aggregation rejects one explicit hypothesis failure", () => {
  const results = allPassAssertionResults().map((result, index) => index === 2
    ? failureResult(result.id)
    : result);
  const hypotheses = aggregateHypothesisProcessResults(results);
  assert.equal(mandatoryHypothesesPassed(hypotheses), false);
  assert.equal(hypotheses[2]?.failureCode, HYPOTHESIS_FAILURE_CODES.H3_HANDLER_CONTEXT_REPLACEMENT);
});

test("process aggregation rejects a missing hypothesis result", () => {
  const hypotheses = aggregateHypothesisProcessResults(allPassAssertionResults().slice(0, -1));
  assert.equal(mandatoryHypothesesPassed(hypotheses), false);
  assert.equal(hypotheses.at(-1)?.failureCode, "STOP_HYPOTHESIS_RESULT_MISSING");
});

test("process aggregation rejects a duplicate hypothesis result", () => {
  const results = [...allPassAssertionResults(), allPassAssertionResults()[0]];
  const hypotheses = aggregateHypothesisProcessResults(results);
  assert.equal(mandatoryHypothesesPassed(hypotheses), false);
  assert.equal(hypotheses[0]?.failureCode, "STOP_HYPOTHESIS_RESULT_DUPLICATE");
});

test("process aggregation records a crashed hypothesis process as terminal failure", () => {
  const results = allPassAssertionResults().map((result, index) => index === 4
    ? { id: result.id, status: "FAIL" as const, processExitCode: 70, failureCode: "STOP_HYPOTHESIS_PROCESS_CRASH" as const }
    : result);
  const hypotheses = aggregateHypothesisProcessResults(results);
  assert.equal(mandatoryHypothesesPassed(hypotheses), false);
  assert.equal(hypotheses[4]?.failureCode, "STOP_HYPOTHESIS_PROCESS_CRASH");
});

test("structured hypothesis FAIL preserves observed safe evidence and exact H-specific code", () => {
  const failed = failureResult("H4_CONTROLLED_ACTIVATION");
  const results = allPassAssertionResults().map((result) => result.id === failed.id ? failed : result);
  const hypotheses = aggregateHypothesisProcessResults(results);
  assert.equal(hypotheses[3]?.status, "FAIL");
  assert.equal(hypotheses[3]?.failureCode, HYPOTHESIS_FAILURE_CODES.H4_CONTROLLED_ACTIVATION);
  assert.deepEqual(hypotheses[3]?.before, failed.before);
  assert.deepEqual(hypotheses[3]?.after, failed.after);
  assert.deepEqual(hypotheses[3]?.deltas, failed.deltas);
  assert.deepEqual(hypotheses[3]?.transactionIds, failed.transactionIds);
  assert.deepEqual(hypotheses[3]?.cookie, failed.cookie);
});

test("process aggregation rejects zero-exit skipped or malformed assertion evidence", () => {
  const results: readonly unknown[] = allPassAssertionResults().map((result, index) => index === 0
    ? { id: result.id, status: "PASS", processExitCode: 0 }
    : result);
  const hypotheses = aggregateHypothesisProcessResults(results);
  assert.equal(mandatoryHypothesesPassed(hypotheses), false);
  assert.equal(hypotheses[0]?.failureCode, "STOP_HYPOTHESIS_RESULT_INVALID");
});

test("assertion results preserve redacted facts and protected fragments aggregate exactly once", async () => {
  await withSyntheticRunRoot(async (runRoot) => {
    for (const result of allPassAssertionResults()) {
      await writeHypothesisAssertionResult(result);
      assert.equal(validateRecordedHypothesisResult(result.id).id, result.id);
    }
    await assert.rejects(
      () => writeHypothesisAssertionResult(assertionResult("H1_NATIVE_TRANSACTION")),
      /EEXIST/,
    );
    const pendingPath = path.join(runRoot, "evidence.pending.json");
    await aggregateProofEvidence(pendingPath, runRoot);
    const pending = readFileSync(pendingPath, "utf8");
    assert.doesNotMatch(pending, /"cleanup"/);
    assert.doesNotMatch(pending, /credentialToken/);
    assert.match(pending, /"credentialRecord": 0/);
    assert.match(pending, /"providerUser": 1/);
    assert.match(pending, /"nameHash": "f{64}"/);
    const parsed = JSON.parse(pending) as { readonly hypotheses: readonly { readonly id: string; readonly status: string }[] };
    assert.deepEqual(parsed.hypotheses.map(({ id }) => id), PROOF_HYPOTHESIS_IDS);
    assert.equal(parsed.hypotheses.every(({ status }) => status === "PASS"), true);
    await assert.rejects(() => aggregateProofEvidence(pendingPath, runRoot), /already exists/);
  });
});

test("failure result writer durably preserves observed safe evidence under the exact hypothesis id", async () => {
  await withSyntheticRunRoot(async (runRoot) => {
    const failed = failureResult("H5_SESSION_COOKIE_AFTER_COMMIT");
    await writeHypothesisResult(failed);
    assert.deepEqual(validateRecordedHypothesisResult(failed.id, "FAIL"), failed);
    const persisted = JSON.parse(readFileSync(
      path.join(runRoot, "evidence-fragments", `${failed.id}.json`),
      "utf8",
    )) as unknown;
    assert.deepEqual(persisted, failed);
  });
});

test("result parser rejects malformed, conflicting, duplicate assertions and dishonest deltas", () => {
  const valid = assertionResult("H1_NATIVE_TRANSACTION");
  assert.deepEqual(parseHypothesisAssertionResult(valid), valid);
  assert.equal(parseHypothesisAssertionResult({ ...valid, assertions: [] }), null);
  assert.equal(parseHypothesisAssertionResult({ ...valid, assertions: [...valid.assertions, ...valid.assertions] }), null);
  assert.equal(parseHypothesisAssertionResult({ ...valid, assertions: ["H2_DIRECT_BOUNDARY_ASSERTIONS_COMPLETE"] }), null);
  assert.equal(parseHypothesisAssertionResult({ ...valid, deltas: EMPTY_COUNTS }), null);
  assert.equal(parseHypothesisAssertionResult({ ...valid, extra: true }), null);
});

test("all seven fragments reject primitive row-count corruption instead of coercing false PASS", () => {
  const corruptions: readonly unknown[] = ["3", true, null, Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1];
  for (const [index, id] of REQUIRED_HYPOTHESIS_IDS.entries()) {
    const valid = assertionResult(id);
    const corrupted = {
      ...valid,
      before: { ...valid.before, providerUser: corruptions[index] },
    };
    assert.equal(parseHypothesisResult(corrupted), null, id);
  }
  const valid = assertionResult("H1_NATIVE_TRANSACTION");
  const { providerUser: _providerUser, ...missing } = valid.before;
  assert.equal(parseHypothesisResult({ ...valid, before: missing }), null);
  assert.equal(parseHypothesisResult({ ...valid, before: { ...valid.before, unexpected: 0 } }), null);
  assert.equal(parseHypothesisResult({ ...valid, after: { ...valid.after, providerUser: Number.MAX_SAFE_INTEGER + 1 } }), null);
});

test("a process failure conflicts with any structured PASS for the same hypothesis", async () => {
  await withSyntheticRunRoot(async () => {
    await writeHypothesisAssertionResult(assertionResult("H1_NATIVE_TRANSACTION"));
    await recordHypothesisProcessFailure("H1_NATIVE_TRANSACTION", 70);
    const combined = [assertionResult("H1_NATIVE_TRANSACTION"), {
      id: "H1_NATIVE_TRANSACTION", status: "FAIL", processExitCode: 70,
      failureCode: "STOP_HYPOTHESIS_PROCESS_CRASH",
    }];
    assert.equal(aggregateHypothesisProcessResults(combined)[0]?.failureCode, "STOP_HYPOTHESIS_RESULT_DUPLICATE");
  });
});

test("attempt claim is atomic, owner-only, durable, and rejects concurrent and sequential retries", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-attempt.");
  await chmod(evidenceRoot, 0o700);
  try {
    const outcomes = await Promise.allSettled([
      claimEvidenceAttempt(evidenceRoot),
      claimEvidenceAttempt(evidenceRoot),
    ]);
    assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
    const attemptRoot = path.join(evidenceRoot, ".proof-attempt-state");
    const claimPath = path.join(attemptRoot, "attempt-claimed.json");
    assert.equal(lstatSync(claimPath).mode & 0o777, 0o600);
    assert.equal(lstatSync(claimPath).isSymbolicLink(), false);
    await assert.rejects(() => claimEvidenceAttempt(evidenceRoot), /EEXIST|attempt already exists/);
    await finalizeEvidenceAttempt(evidenceRoot, "FAIL");
    assert.equal(existsSync(claimPath), true);
    assert.equal(lstatSync(path.join(attemptRoot, "final-state.json")).mode & 0o777, 0o600);
    await assert.rejects(() => finalizeEvidenceAttempt(evidenceRoot, "PASS"), /EEXIST/);
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("attempt claim leaves durable prevalidated FAIL recovery material", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-attempt.");
  await chmod(evidenceRoot, 0o700);
  try {
    const attemptRoot = await claimEvidenceAttempt(evidenceRoot);
    const failureRoot = path.join(attemptRoot, "failure-material");
    const failure = JSON.parse(readFileSync(path.join(failureRoot, "fail-1110.json"), "utf8")) as {
      readonly status: string;
      readonly cleanup: Readonly<Record<string, boolean>>;
    };
    assert.equal(failure.status, "FAIL");
    assert.deepEqual(failure.cleanup, {
      serverStopped: true, listenerGone: true, pidGone: true, rootGone: false,
    });
    assert.match(readFileSync(path.join(failureRoot, "fail-1110.md"), "utf8"), /NON-AUTHORITATIVE/);
    const serialized = readFileSync(path.join(failureRoot, "fail-1110.json"), "utf8");
    for (const forbidden of [
      /https?:\/\//i,
      /postgres(?:ql)?:\/\//i,
      /\/(?:Users|private|tmp|var|opt|home)\//,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    ]) assert.doesNotMatch(serialized, forbidden);
    assert.equal(lstatSync(path.join(attemptRoot, "logs")).mode & 0o777, 0o700);
    assert.equal(lstatSync(path.join(failureRoot, "fail-1110.json")).mode & 0o777, 0o600);
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("every partial startup phase retains its root and stops only a proven postmaster", () => {
  const phases: readonly ProofPhase[] = [
    "CLAIMED", "ROOT_CREATED", "IDENTITY_CREATED", "DATA_INITIALIZED",
    "POSTMASTER_STARTED", "CLUSTER_IDENTITY_PROVEN", "SCHEMA_APPLIED",
  ];
  for (const phase of phases) {
    const postmasterProven = phase === "POSTMASTER_STARTED"
      || phase === "CLUSTER_IDENTITY_PROVEN"
      || phase === "SCHEMA_APPLIED";
    const plan = planCleanup({
      phase,
      rootExists: phase !== "CLAIMED",
      postmasterProven,
      listenerPresent: postmasterProven,
      fullIdentityProven: phase === "CLUSTER_IDENTITY_PROVEN" || phase === "SCHEMA_APPLIED",
      pendingPrepared: false,
      signal: "NONE",
    });
    assert.equal(plan.attemptClaimRetained, true, phase);
    assert.equal(plan.stopProvenPostmaster, postmasterProven, phase);
    assert.equal(plan.deleteRootAfterStoppedChecks, false, phase);
    assert.equal(plan.usePrevalidatedFailureMaterial, true, phase);
    assert.equal(plan.forceFailure, true, phase);
  }
});

test("unproven listener fails closed without stop or deletion", () => {
  const plan = planCleanup({
    phase: "DATA_INITIALIZED",
    rootExists: true,
    postmasterProven: false,
    listenerPresent: true,
    fullIdentityProven: false,
    pendingPrepared: false,
    signal: "NONE",
  });
  assert.equal(plan.stopProvenPostmaster, false);
  assert.equal(plan.deleteRootAfterStoppedChecks, false);
  assert.equal(plan.failureCode, "STOP_UNPROVEN_LISTENER");
});

for (const signal of ["INT", "TERM"] as const) {
  test(`${signal} forces FAIL, retains the attempt, and never permits partial PASS`, () => {
    const plan = planCleanup({
      phase: "PENDING_READY",
      rootExists: true,
      postmasterProven: true,
      listenerPresent: true,
      fullIdentityProven: true,
      pendingPrepared: true,
      signal,
    });
    assert.equal(plan.attemptClaimRetained, true);
    assert.equal(plan.stopProvenPostmaster, true);
    assert.equal(plan.forceFailure, true);
    assert.equal(plan.failureCode, "STOP_SIGNAL");
  });
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
  assert.throws(
    () => validateGeneratedSql(`> passvero-better-auth-transaction-proof@1.0.0 schema:sql\n${sql}`),
    /STOP_RUN_ROOT_INVALID/,
  );
  assert.throws(
    () => validateGeneratedSql(`${sql}\nSELECT 1;`),
    /STOP_RUN_ROOT_INVALID/,
  );
  assert.throws(
    () => validateGeneratedSql(`${sql}\nCREATE INDEX "unreviewed_index" ON "User" ("id");`),
    /STOP_RUN_ROOT_INVALID/,
  );
});

test("cleanup evidence preparation rejects sensitive pending drafts before finalization", async () => {
  const runRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(runRoot, 0o700);
  const pendingPath = path.join(runRoot, "evidence.pending.json");
  const preparedPath = path.join(runRoot, ".proof-attempt-state", "prepared");
  try {
    await claimEvidenceAttempt(runRoot);
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
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const exact = exactMandatoryEvidence();
  const { cleanup: _cleanup, ...exactPending } = exact;
  const variants = [
    { evidence: exactPending, verdict: "PASS" },
    { evidence: { ...exactPending, hypotheses: exactPending.hypotheses.map((item, index) => index === 3 ? { ...item, status: "FAIL" as const } : item) }, verdict: "FAIL" },
    { evidence: { ...exactPending, hypotheses: exactPending.hypotheses.map((item, index) => index === 2 ? { ...item, assertions: [] } : item) }, verdict: "FAIL" },
    { evidence: { ...exactPending, hypotheses: exactPending.hypotheses.slice(0, -1) }, verdict: "FAIL" },
    { evidence: { ...exactPending, hypotheses: [...exactPending.hypotheses.slice(0, -1), exactPending.hypotheses[0]] }, verdict: "FAIL" },
  ];
  try {
    await claimEvidenceAttempt(evidenceRoot);
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

async function assertOmittedPendingCallbackFailsClosed(
  omittedCallback: "retirePending" | "inspectPending",
): Promise<void> {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  const callbackCalls: string[] = [];
  const commitOrder: string[] = [];
  const suppliedCallback = omittedCallback === "retirePending"
    ? {
        inspectPending: async (candidate: string) => {
          callbackCalls.push("inspectPending");
          return lstat(candidate);
        },
      }
    : {
        retirePending: async (candidate: string) => {
          callbackCalls.push("retirePending");
          await unlink(candidate);
        },
      };
  try {
    await claimEvidenceAttempt(evidenceRoot);
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    const expectedJson = readFileSync(path.join(preparedPath, "fail-1111.json"), "utf8");
    const expectedMarkdown = readFileSync(path.join(preparedPath, "fail-1111.md"), "utf8");
    const result = await publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      ...suppliedCallback,
      renamePublication: async (source: string, destination: string) => {
        commitOrder.push(path.basename(destination));
        await rename(source, destination);
      },
    });

    assert.deepEqual(callbackCalls, []);
    assert.equal(result.passed, false);
    assert.equal(result.exitCode, 1);
    assert.equal(result.status, "FAIL_PENDING_RETAINED");
    assert.equal(result.authoritativeCandidate, "fail-1111");
    assert.equal(lstatSync(pendingPath).isFile(), true);
    assert.deepEqual(commitOrder, ["evidence.json", "evidence.md"]);
    const authoritativeJson = readFileSync(path.join(evidenceRoot, "evidence.json"), "utf8");
    assert.equal(readFileSync(path.join(evidenceRoot, "evidence.md"), "utf8"), expectedMarkdown);
    assert.equal(authoritativeJson, expectedJson);
    assert.equal(existsSync(path.join(evidenceRoot, ".proof-attempt-state", ".evidence-publication.md")), false);
    assert.equal(existsSync(path.join(evidenceRoot, ".proof-attempt-state", ".evidence-publication.json")), false);
    const authoritative = JSON.parse(authoritativeJson) as { status: string };
    assert.equal(authoritative.status, "FAIL");
    assert.notEqual(authoritative.status, "PASS");
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
}

test("omitted pending retirement callback commits checked FAIL with JSON authoritative last", async () => {
  await assertOmittedPendingCallbackFailsClosed("retirePending");
});

test("omitted pending inspection callback commits checked FAIL with JSON authoritative last", async () => {
  await assertOmittedPendingCallbackFailsClosed("inspectPending");
});

test("resolved no-op pending retirement executes checked FAIL publication and discards PASS", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  try {
    await claimEvidenceAttempt(evidenceRoot);
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    const result = await publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      retirePending: async () => undefined,
      inspectPending: lstatSync,
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

test("surviving pending symlink is not treated as retired", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-pg.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  try {
    await claimEvidenceAttempt(evidenceRoot);
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    const result = await publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      retirePending: async (candidate: string) => {
        await unlink(candidate);
        await symlink(path.join(preparedPath, "pass-1111.json"), candidate);
      },
      inspectPending: lstatSync,
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.authoritativeCandidate, "fail-1111");
    assert.equal(lstatSync(pendingPath).isSymbolicLink(), true);
    const authoritative = JSON.parse(readFileSync(path.join(evidenceRoot, "evidence.json"), "utf8")) as { status: string };
    assert.equal(authoritative.status, "FAIL");
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("PASS becomes authoritative only on the final JSON rename after checked cleanup", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-publication.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  const committed: string[] = [];
  try {
    await claimEvidenceAttempt(evidenceRoot);
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    const result = await publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      retirePending: unlink,
      inspectPending: lstat,
      renamePublication: async (source: string, destination: string) => {
        committed.push(`${path.basename(source)}>${path.basename(destination)}`);
        await rename(source, destination);
      },
    });
    assert.equal(result.passed, true);
    assert.deepEqual(committed.map((entry) => entry.split(">")[1]), [
      "evidence.json", "evidence.md", "evidence.md", "evidence.json",
    ]);
    assert.equal(existsSync(pendingPath), false);
    const authoritative = JSON.parse(readFileSync(path.join(evidenceRoot, "evidence.json"), "utf8")) as { readonly status: string };
    assert.equal(authoritative.status, "PASS");
    assert.match(readFileSync(path.join(evidenceRoot, "evidence.md"), "utf8"), /NON-AUTHORITATIVE/);
    assert.equal(existsSync(path.join(evidenceRoot, ".proof-attempt-state", "attempt-claimed.json")), true);
    const commitReady = JSON.parse(readFileSync(
      path.join(evidenceRoot, ".proof-attempt-state", "commit-ready-state.json"),
      "utf8",
    )) as { readonly state: string; readonly status: string };
    assert.deepEqual(commitReady, { state: "COMMIT_READY", status: "PASS" });
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("commit-ready persistence failure occurs before authoritative PASS and leaves checked FAIL", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-publication.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  try {
    await claimEvidenceAttempt(evidenceRoot);
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    await assert.rejects(() => publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      retirePending: unlink,
      inspectPending: lstat,
      writeCommitReady: async () => { throw new Error("INJECTED_COMMIT_READY_FAILURE"); },
    }), /INJECTED_COMMIT_READY_FAILURE/);
    const authoritative = JSON.parse(readFileSync(path.join(evidenceRoot, "evidence.json"), "utf8")) as {
      readonly status: string;
    };
    assert.equal(authoritative.status, "FAIL");
    assert.equal(existsSync(path.join(evidenceRoot, ".proof-attempt-state", "final-state.json")), false);
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

test("PASS marker failure occurs before authoritative JSON and leaves checked FAIL", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-publication.");
  await chmod(evidenceRoot, 0o700);
  const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
  const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
  const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
  try {
    await claimEvidenceAttempt(evidenceRoot);
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
    await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
    await assert.rejects(() => publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: preparedPath,
      pendingPath,
      candidate: "pass-1111",
      retirePending: unlink,
      inspectPending: lstat,
      beforeAuthoritativePass: () => { throw new Error("INJECTED_PASS_MARKER_FAILURE"); },
    }), /INJECTED_PASS_MARKER_FAILURE/);
    const authoritative = JSON.parse(readFileSync(path.join(evidenceRoot, "evidence.json"), "utf8")) as {
      readonly status: string;
    };
    assert.equal(authoritative.status, "FAIL");
  } finally {
    await rm(evidenceRoot, { recursive: true });
  }
});

for (const failAt of [1, 2, 3, 4]) {
  test(`PASS publication rename failure ${failAt} cannot make authoritative JSON PASS`, async () => {
    const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-publication.");
    await chmod(evidenceRoot, 0o700);
    const pendingPath = path.join(evidenceRoot, "evidence.pending.json");
    const preparedPath = path.join(evidenceRoot, ".proof-attempt-state", "prepared");
    const { cleanup: _cleanup, ...pending } = exactMandatoryEvidence();
    let call = 0;
    try {
      await claimEvidenceAttempt(evidenceRoot);
      await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 });
      await prepareCleanupEvidence(pendingPath, preparedPath, evidenceRoot);
      await assert.rejects(() => publishEvidenceState({
        evidenceDirectory: evidenceRoot,
        preparedDirectory: preparedPath,
        pendingPath,
        candidate: "pass-1111",
        retirePending: unlink,
        inspectPending: lstat,
        renamePublication: async (source: string, destination: string) => {
          call += 1;
          if (call === failAt) throw new Error("INJECTED_RENAME_FAILURE");
          await rename(source, destination);
        },
      }), /INJECTED_RENAME_FAILURE/);
      const finalJson = path.join(evidenceRoot, "evidence.json");
      if (existsSync(finalJson)) {
        const evidence = JSON.parse(readFileSync(finalJson, "utf8")) as { readonly status: string };
        assert.equal(evidence.status, "FAIL");
      }
      const finalMarkdown = path.join(evidenceRoot, "evidence.md");
      if (existsSync(finalMarkdown)) assert.match(readFileSync(finalMarkdown, "utf8"), /NON-AUTHORITATIVE/);
      assert.equal(existsSync(path.join(evidenceRoot, ".proof-attempt-state", "attempt-claimed.json")), true);
      assert.equal(existsSync(path.join(evidenceRoot, ".proof-attempt-state", "failure-material", "fail-1111.json")), true);
    } finally {
      await rm(evidenceRoot, { recursive: true });
    }
  });
}

for (const failAt of [1, 2]) {
  test(`FAIL publication rename failure ${failAt} retains recoverable attempt state`, async () => {
    const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-publication.");
    await chmod(evidenceRoot, 0o700);
    let call = 0;
    try {
      const attemptRoot = await claimEvidenceAttempt(evidenceRoot);
      await assert.rejects(() => publishEvidenceState({
        evidenceDirectory: evidenceRoot,
        preparedDirectory: path.join(attemptRoot, "failure-material"),
        pendingPath: null,
        candidate: "fail-1110",
        renamePublication: async (source: string, destination: string) => {
          call += 1;
          if (call === failAt) throw new Error("INJECTED_RENAME_FAILURE");
          await rename(source, destination);
        },
      }), /INJECTED_RENAME_FAILURE/);
      const finalJson = path.join(evidenceRoot, "evidence.json");
      if (existsSync(finalJson)) {
        const evidence = JSON.parse(readFileSync(finalJson, "utf8")) as { readonly status: string };
        assert.equal(evidence.status, "FAIL");
      }
      assert.equal(existsSync(path.join(attemptRoot, "attempt-claimed.json")), true);
      assert.equal(existsSync(path.join(attemptRoot, "final-state.json")), false);
    } finally {
      await rm(evidenceRoot, { recursive: true });
    }
  });
}

test("FAIL staging exception cannot create final-state or authoritative PASS", async () => {
  const evidenceRoot = await mkdtemp("/private/tmp/passvero-stage13a-publication.");
  await chmod(evidenceRoot, 0o700);
  try {
    const attemptRoot = await claimEvidenceAttempt(evidenceRoot);
    await assert.rejects(() => publishEvidenceState({
      evidenceDirectory: evidenceRoot,
      preparedDirectory: path.join(attemptRoot, "failure-material"),
      pendingPath: null,
      candidate: "fail-1110",
      stagePublication: async () => { throw new Error("INJECTED_STAGE_FAILURE"); },
    }), /INJECTED_STAGE_FAILURE/);
    assert.equal(existsSync(path.join(attemptRoot, "final-state.json")), false);
    assert.equal(existsSync(path.join(evidenceRoot, "evidence.json")), false);
    assert.equal(existsSync(path.join(attemptRoot, "attempt-claimed.json")), true);
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
  for (const sensitive of [
    "https://invalid.example/auth/callback",
    "/private/tmp/passvero-stage13a-pg.abcdef/log/postgres.log",
    `(${JSON.stringify("/private/tmp/passvero-stage13a-pg.abcdef/log/private.log")})`,
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    "0123456789abcdef0123456789abcdef",
    "opaque-proof-material-with-lowercase-letters-and-dashes-0123456789ABCDEFGHIJ",
    "tx:raw-transaction-identity-0123456789",
    "opaque_authentication_material_ABC123456789",
    "transaction 123456789012345678",
    ["symlink target ", "Users", "operator", "private-proof.log"].join("/"),
  ]) {
    assert.throws(
      () => renderEvidenceJson({ ...evidence, assertions: [sensitive] }),
      /STOP_EVIDENCE_REDACTION/,
    );
  }
  const { cleanup: _cleanup, ...pending } = evidence;
  const renderedPending = renderPendingEvidenceJson(pending);
  assert.doesNotMatch(renderedPending, /"cleanup"/);
  assert.throws(
    () => renderPendingEvidenceJson({ ...pending, assertions: [serializedCookie] }),
    /STOP_EVIDENCE_REDACTION/,
  );
});
