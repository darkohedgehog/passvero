import { lstat, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
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

export async function publishEvidenceState(input) {
  const evidenceRoot = input.evidenceDirectory;
  const preparedRoot = input.preparedDirectory;
  const pendingPath = input.pendingPath;
  if (!/^(?:pass-1111|fail-[01]{4})$/.test(input.candidate)) fail("candidate is invalid");
  await validateDirectory(evidenceRoot, "evidence directory");
  if (preparedRoot !== path.join(evidenceRoot, ".cleanup-evidence-prepared")) fail("prepared path is not authoritative");
  if (pendingPath !== path.join(evidenceRoot, "evidence.pending.json")) fail("pending path is not authoritative");
  await validateDirectory(preparedRoot, "prepared directory", 0o700);
  await validateFile(pendingPath, "pending evidence");

  const stageJson = path.join(evidenceRoot, ".evidence-publication.json");
  const stageMarkdown = path.join(evidenceRoot, ".evidence-publication.md");
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

  async function commit() {
    const renamePublication = input.renamePublication ?? rename;
    await renamePublication(stageMarkdown, finalMarkdown);
    await renamePublication(stageJson, finalJson);
  }

  await stage(input.candidate);
  let pendingRetired = false;
  const canRetirePending = typeof input.retirePending === "function" && typeof input.inspectPending === "function";
  if (canRetirePending) {
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
  if (!pendingRetired && input.candidate === "pass-1111") await stage("fail-1111");

  const authoritativeCandidate = pendingRetired ? input.candidate : input.candidate.replace(/^pass-/, "fail-");
  await commit();
  const passed = pendingRetired && authoritativeCandidate === "pass-1111";
  return {
    passed,
    exitCode: passed ? 0 : 1,
    status: passed ? "PASS" : pendingRetired ? "FAIL" : "FAIL_PENDING_RETAINED",
    authoritativeCandidate,
  };
}

async function runCli() {
  if (process.argv.length !== 6) fail("usage: publication.mjs <evidence-dir> <prepared-dir> <pending> <candidate>");
  const result = await publishEvidenceState({
    evidenceDirectory: process.argv[2],
    preparedDirectory: process.argv[3],
    pendingPath: process.argv[4],
    candidate: process.argv[5],
    retirePending: unlink,
    inspectPending: lstat,
  });
  process.stdout.write(`PUBLICATION=${result.status}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === await realpath(process.argv[1])) {
  await runCli();
}
