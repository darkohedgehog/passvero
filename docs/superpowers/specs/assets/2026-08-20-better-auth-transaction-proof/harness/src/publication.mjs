import { writeSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  throw new Error(`STOP_EVIDENCE_PUBLICATION: ${message}`);
}

async function validateDirectory(candidate, label, expectedMode) {
  const status = await lstat(candidate);
  if (status.isSymbolicLink() || !status.isDirectory()) fail(`${label} must be a non-symlink directory`);
  if (typeof process.getuid !== "function" || status.uid !== process.getuid()) fail(`${label} owner mismatch`);
  if (expectedMode !== undefined && (status.mode & 0o777) !== expectedMode) fail(`${label} mode mismatch`);
  if (await realpath(candidate) !== candidate) fail(`${label} must already be a real path`);
}

async function validateFile(candidate, label) {
  const status = await lstat(candidate);
  if (status.isSymbolicLink() || !status.isFile()) fail(`${label} must be a non-symlink file`);
  if (typeof process.getuid !== "function" || status.uid !== process.getuid()) fail(`${label} owner mismatch`);
  if ((status.mode & 0o777) !== 0o600) fail(`${label} mode mismatch`);
}

async function removeIfPresent(candidate) {
  try {
    await unlink(candidate);
  } catch (error) {
    if (!(error instanceof Error) || !Object.hasOwn(error, "code") || error.code !== "ENOENT") throw error;
  }
}

const REQUIRED_HYPOTHESIS_IDS = [
  "H1_NATIVE_TRANSACTION", "H2_DIRECT_API_OUTER_TRANSACTION", "H3_HANDLER_CONTEXT_REPLACEMENT",
  "H4_CONTROLLED_ACTIVATION", "H5_SESSION_COOKIE_AFTER_COMMIT", "H6_RECOVERY_AND_REVOCATION",
  "H7_ROUTE_EXPOSURE",
];

const ZERO_COUNTS = {
  providerUser: 0, providerAccount: 0, providerSession: 0, providerVerification: 0,
  canonicalUser: 0, authIdentity: 0, activation: 0, credentialRecord: 0, abuseBucket: 0,
};

function preEvidenceFailure(cleanup) {
  return {
    status: "FAIL",
    packageHashes: { unavailableHash: "0".repeat(64) },
    clusterIdHash: "0".repeat(64),
    postgresVersionHash: "0".repeat(64),
    systemIdentifierHash: "0".repeat(64),
    hypotheses: REQUIRED_HYPOTHESIS_IDS.map((id) => ({
      id,
      status: "FAIL",
      transactionIds: [],
      before: ZERO_COUNTS,
      after: ZERO_COUNTS,
      deltas: ZERO_COUNTS,
      cookie: {
        present: false, nameHash: null, secure: false, httpOnly: false,
        sameSite: null, hostOnly: true, maxAgeSeconds: null,
      },
      assertions: [],
      failureCode: "STOP_PRE_EVIDENCE_FAILURE",
    })),
    cleanup,
    assertions: ["STOP_PRE_EVIDENCE_FAILURE"],
  };
}

function companionMarkdown(evidence) {
  const rows = evidence.hypotheses.map((item) => `| ${item.id} | ${item.status} | ${item.failureCode ?? "none"} |`);
  return [
    "# Better Auth transaction proof evidence companion",
    "",
    "NON-AUTHORITATIVE: evidence.json is the sole authoritative proof result.",
    "",
    "| Hypothesis | Status | Failure code |",
    "| --- | --- | --- |",
    ...rows,
    "",
    `Cleanup checks: ${Object.values(evidence.cleanup).every(Boolean) ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
}

async function writeProtected(candidate, value) {
  await writeFile(candidate, value, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await validateFile(candidate, "protected state file");
}

export async function claimEvidenceAttempt(evidenceDirectory) {
  const evidenceRoot = evidenceDirectory;
  await validateDirectory(evidenceRoot, "evidence directory");
  for (const name of ["evidence.pending.json", "evidence.json", "evidence.md"]) {
    try {
      await lstat(path.join(evidenceRoot, name));
      fail("an evidence attempt already exists");
    } catch (error) {
      if (!(error instanceof Error) || !Object.hasOwn(error, "code") || error.code !== "ENOENT") throw error;
    }
  }
  const attemptRoot = path.join(evidenceRoot, ".proof-attempt-state");
  try {
    await mkdir(attemptRoot, { mode: 0o700 });
  } catch (error) {
    if (!(error instanceof Error) || !Object.hasOwn(error, "code") || error.code !== "EEXIST") throw error;
  }
  await validateDirectory(attemptRoot, "attempt state directory", 0o700);
  await writeProtected(
    path.join(attemptRoot, "attempt-claimed.json"),
    `${JSON.stringify({ state: "CLAIMED", version: 1 })}\n`,
  );
  const failureRoot = path.join(attemptRoot, "failure-material");
  await mkdir(failureRoot, { mode: 0o700 });
  await validateDirectory(failureRoot, "failure material directory", 0o700);
  const logRoot = path.join(attemptRoot, "logs");
  await mkdir(logRoot, { mode: 0o700 });
  await validateDirectory(logRoot, "attempt log directory", 0o700);
  await writeProtected(path.join(logRoot, "orchestration.log"), "");
  for (let mask = 0; mask < 16; mask += 1) {
    const suffix = mask.toString(2).padStart(4, "0");
    const evidence = preEvidenceFailure({
      serverStopped: Boolean(mask & 8),
      listenerGone: Boolean(mask & 4),
      pidGone: Boolean(mask & 2),
      rootGone: Boolean(mask & 1),
    });
    await writeProtected(path.join(failureRoot, `fail-${suffix}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
    await writeProtected(path.join(failureRoot, `fail-${suffix}.md`), companionMarkdown(evidence));
  }
  return attemptRoot;
}

export async function finalizeEvidenceAttempt(evidenceDirectory, status) {
  if (status !== "PASS" && status !== "FAIL") fail("attempt final status is invalid");
  const attemptRoot = path.join(evidenceDirectory, ".proof-attempt-state");
  await validateDirectory(attemptRoot, "attempt state directory", 0o700);
  await validateFile(path.join(attemptRoot, "attempt-claimed.json"), "attempt claim");
  await writeProtected(
    path.join(attemptRoot, "final-state.json"),
    `${JSON.stringify({ state: "FINAL", status })}\n`,
  );
}

export async function publishEvidenceState(input) {
  const evidenceRoot = input.evidenceDirectory;
  const preparedRoot = input.preparedDirectory;
  const pendingPath = input.pendingPath ?? null;
  if (!/^(?:pass-1111|fail-[01]{4})$/.test(input.candidate)) fail("candidate is invalid");
  await validateDirectory(evidenceRoot, "evidence directory");
  const attemptRoot = path.join(evidenceRoot, ".proof-attempt-state");
  await validateDirectory(attemptRoot, "attempt state directory", 0o700);
  if (![path.join(attemptRoot, "prepared"), path.join(attemptRoot, "failure-material")].includes(preparedRoot)) {
    fail("prepared path is not authoritative");
  }
  if (pendingPath !== null && pendingPath !== path.join(evidenceRoot, "evidence.pending.json")) {
    fail("pending path is not authoritative");
  }
  await validateDirectory(preparedRoot, "prepared directory", 0o700);
  if (pendingPath !== null) await validateFile(pendingPath, "pending evidence");

  const stageJson = path.join(attemptRoot, ".evidence-publication.json");
  const stageMarkdown = path.join(attemptRoot, ".evidence-publication.md");
  const finalJson = path.join(evidenceRoot, "evidence.json");
  const finalMarkdown = path.join(evidenceRoot, "evidence.md");

  async function stage(candidate) {
    const sourceJson = path.join(preparedRoot, `${candidate}.json`);
    const sourceMarkdown = path.join(preparedRoot, `${candidate}.md`);
    await validateFile(sourceJson, "prepared JSON");
    await validateFile(sourceMarkdown, "prepared Markdown");
    await removeIfPresent(stageJson);
    await removeIfPresent(stageMarkdown);
    await writeFile(stageMarkdown, await readFile(sourceMarkdown), { mode: 0o600, flag: "wx" });
    await writeFile(stageJson, await readFile(sourceJson), { mode: 0o600, flag: "wx" });
    await validateFile(stageMarkdown, "staged Markdown");
    await validateFile(stageJson, "staged JSON");
  }

  const renamePublication = input.renamePublication ?? rename;
  const stagePublication = input.stagePublication ?? stage;
  const assertPublicationAllowed = input.assertPublicationAllowed ?? (() => undefined);

  async function commitFail(candidate) {
    await stagePublication(candidate);
    await renamePublication(stageJson, finalJson);
    await renamePublication(stageMarkdown, finalMarkdown);
  }

  if (input.candidate !== "pass-1111") {
    await commitFail(input.candidate);
    return { passed: false, exitCode: 1, status: "FAIL", authoritativeCandidate: input.candidate };
  }

  if (preparedRoot !== path.join(attemptRoot, "prepared")) fail("PASS requires prepared proof material");
  assertPublicationAllowed();
  await commitFail("fail-1111");
  assertPublicationAllowed();

  let pendingRetired = false;
  if (pendingPath !== null
    && typeof input.retirePending === "function"
    && typeof input.inspectPending === "function") {
    try {
      await input.retirePending(pendingPath);
      try {
        await input.inspectPending(pendingPath);
      } catch (error) {
        if (error instanceof Error && Object.hasOwn(error, "code") && error.code === "ENOENT") {
          pendingRetired = true;
        } else {
          throw error;
        }
      }
    } catch {
      pendingRetired = false;
    }
  }
  if (!pendingRetired) {
    return {
      passed: false,
      exitCode: 1,
      status: "FAIL_PENDING_RETAINED",
      authoritativeCandidate: "fail-1111",
    };
  }

  const commitReadyPath = path.join(attemptRoot, "commit-ready-state.json");
  const writeCommitReady = input.writeCommitReady ?? writeProtected;
  await writeCommitReady(
    commitReadyPath,
    `${JSON.stringify({ state: "COMMIT_READY", status: "PASS" })}\n`,
  );
  await validateFile(commitReadyPath, "commit-ready state");
  assertPublicationAllowed();
  await stagePublication("pass-1111");
  assertPublicationAllowed();
  await renamePublication(stageMarkdown, finalMarkdown);
  assertPublicationAllowed();
  if (typeof input.beforeAuthoritativePass === "function") await input.beforeAuthoritativePass();
  assertPublicationAllowed();
  await renamePublication(stageJson, finalJson);
  const interruptedAfterCommit = typeof input.wasPublicationInterrupted === "function"
    ? input.wasPublicationInterrupted()
    : false;
  return {
    passed: true,
    exitCode: 0,
    status: "PASS",
    authoritativeCandidate: "pass-1111",
    interruptedAfterCommit,
  };
}

function createPublicationInterrupt(evidenceDirectory) {
  const abortController = new AbortController();
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    abortController.abort();
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);

  function assertPublicationAllowed() {
    if (interrupted) fail("publication interrupted");
  }

  async function beforeAuthoritativePass() {
    assertPublicationAllowed();
    if (process.env.PASSVERO_PROOF_STATIC_PUBLICATION_DELAY === "1") {
      await writeProtected(path.join(evidenceDirectory, "pre-json-window"), "READY\n");
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5_000);
        abortController.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("STOP_EVIDENCE_PUBLICATION: publication interrupted"));
        }, { once: true });
      });
    }
    assertPublicationAllowed();
  }

  function dispose() {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }

  return {
    assertPublicationAllowed,
    beforeAuthoritativePass,
    wasInterrupted: () => interrupted,
    dispose,
  };
}

async function runCli() {
  if (process.argv[2] === "claim" && process.argv.length === 4) {
    await claimEvidenceAttempt(process.argv[3]);
    return;
  }
  if (process.argv[2] === "finalize" && process.argv.length === 5) {
    await finalizeEvidenceAttempt(process.argv[3], process.argv[4]);
    return;
  }
  if (process.argv[2] !== "publish" || process.argv.length !== 7) {
    fail("usage: publication.mjs publish <evidence-dir> <prepared-dir> <pending-or-dash> <candidate>");
  }
  const publicationInterrupt = createPublicationInterrupt(process.argv[3]);
  let passMarkerWritten = false;
  try {
    const result = await publishEvidenceState({
      evidenceDirectory: process.argv[3],
      preparedDirectory: process.argv[4],
      pendingPath: process.argv[5] === "-" ? null : process.argv[5],
      candidate: process.argv[6],
      retirePending: unlink,
      inspectPending: lstat,
      assertPublicationAllowed: publicationInterrupt.assertPublicationAllowed,
      wasPublicationInterrupted: publicationInterrupt.wasInterrupted,
      beforeAuthoritativePass: async () => {
        await publicationInterrupt.beforeAuthoritativePass();
        publicationInterrupt.assertPublicationAllowed();
        writeSync(1, "PUBLICATION=PASS\n");
        passMarkerWritten = true;
      },
    });
    if (!passMarkerWritten) writeSync(1, `PUBLICATION=${result.status}\n`);
    process.exitCode = result.exitCode;
  } finally {
    publicationInterrupt.dispose();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === await realpath(process.argv[1])) {
  await runCli();
}
