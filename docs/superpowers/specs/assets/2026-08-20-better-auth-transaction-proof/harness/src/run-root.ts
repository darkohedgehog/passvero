import { createHash, randomBytes } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregateHypothesisProcessResults,
  parseHypothesisAssertionResult,
  parseHypothesisResult,
  renderEvidenceJson,
  renderEvidenceMarkdown,
  renderPendingEvidenceJson,
  REQUIRED_HYPOTHESIS_IDS,
  type HypothesisAssertionResult,
  type HypothesisFailureResult,
  type HypothesisId,
  type HypothesisProcessFailure,
  type ProofEvidence,
} from "./evidence.js";

const RUN_ROOT_PATTERN = /^\/private\/tmp\/passvero-stage13a-pg\.[A-Za-z0-9]+$/;
const STATIC_HARNESS_PATTERN = /^\/private\/tmp\/passvero-stage13a-harness\.[A-Za-z0-9]+$/;
const LIVE_HARNESS_PATTERN = /^\/private\/tmp\/passvero-stage13a-pg\.[A-Za-z0-9]+\/harness$/;
const ROLE_PATTERN = /^pvproof_(?:admin|app)_[a-f0-9]{12}$/;
const DATABASE_PATTERN = /^pvproof_test_[a-f0-9]{12}$/;
const BASE64URL_48 = /^[A-Za-z0-9_-]{48}$/;
export const PROOF_ROOT_SENTINEL = "PASSVERO_STAGE13A_PG_V1";
export const ATTEMPT_STATE_NAME = ".proof-attempt-state";
const IDENTITY_NAMES = [
  "superuser-role",
  "superuser-password",
  "application-role",
  "application-password",
  "database",
  "port",
  "socket-dir",
] as const;

export interface RunIdentity {
  readonly runRoot: string;
  readonly superuserRole: string;
  readonly superuserPassword: string;
  readonly applicationRole: string;
  readonly applicationPassword: string;
  readonly database: string;
  readonly port: 55432;
  readonly socketDir: string;
}

function opaqueBase64Url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

async function writeProtected(filePath: string, value: string): Promise<void> {
  await writeFile(filePath, value, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

export async function bootstrapRunRoot(candidate: string): Promise<void> {
  if (!RUN_ROOT_PATTERN.test(candidate)) fail("bootstrap root path does not match the proof prefix");
  const runRoot = assertProtectedDirectory(candidate, "bootstrap root");
  const identityDir = path.join(runRoot, "identity");
  const socketDir = path.join(runRoot, "socket");
  const logDir = path.join(runRoot, "log");
  const sqlDir = path.join(runRoot, "sql");
  await mkdir(identityDir, { mode: 0o700 });
  await mkdir(socketDir, { mode: 0o700 });
  await mkdir(logDir, { mode: 0o700 });
  await mkdir(sqlDir, { mode: 0o700 });
  await mkdir(path.join(runRoot, "evidence-fragments"), { mode: 0o700 });
  await mkdir(path.join(runRoot, "process-failures"), { mode: 0o700 });

  const runId = opaqueBase64Url(24);
  const values = new Map<string, string>([
    ["superuser-role", `pvproof_admin_${randomBytes(6).toString("hex")}`],
    ["superuser-password", opaqueBase64Url(36)],
    ["application-role", `pvproof_app_${randomBytes(6).toString("hex")}`],
    ["application-password", opaqueBase64Url(36)],
    ["database", `pvproof_test_${randomBytes(6).toString("hex")}`],
    ["port", "55432"],
    ["socket-dir", socketDir],
    ["auth-secret", opaqueBase64Url(36)],
    ["run-id", runId],
  ]);
  await writeProtected(
    path.join(runRoot, ".passvero-stage13a-proof-root"),
    `${PROOF_ROOT_SENTINEL}:${runId}`,
  );
  for (const [name, value] of values) {
    await writeProtected(path.join(identityDir, name), value);
  }

  const superuserRole = values.get("superuser-role");
  const superuserPassword = values.get("superuser-password");
  const applicationRole = values.get("application-role");
  const applicationPassword = values.get("application-password");
  const database = values.get("database");
  if (!superuserRole || !superuserPassword || !applicationRole || !applicationPassword || !database) {
    fail("generated identity is incomplete");
  }
  if (!/^pvproof_admin_[a-f0-9]{12}$/.test(superuserRole)) fail("generated superuser role is invalid");
  if (!/^pvproof_app_[a-f0-9]{12}$/.test(applicationRole)) fail("generated application role is invalid");
  if (!DATABASE_PATTERN.test(database)) fail("generated database is invalid");
  if (!BASE64URL_48.test(superuserPassword) || !BASE64URL_48.test(applicationPassword)) {
    fail("generated credential is invalid");
  }
  const runIdHash = createHash("sha256").update(runId).digest("hex");
  await writeProtected(path.join(identityDir, "run-id-hash"), runIdHash);
  await writeProtected(
    path.join(identityDir, "superuser-pgpass"),
    `127.0.0.1:55432:*:${superuserRole}:${superuserPassword}`,
  );
  await writeProtected(
    path.join(identityDir, "application-pgpass"),
    `127.0.0.1:55432:${database}:${applicationRole}:${applicationPassword}`,
  );
  await writeProtected(
    path.join(sqlDir, "cluster-bootstrap.sql"),
    [
      "CREATE ROLE :\"app_role\" LOGIN;",
      "CREATE DATABASE :\"database\" OWNER :\"app_role\";",
      "REVOKE CONNECT, TEMPORARY ON DATABASE :\"database\" FROM PUBLIC;",
    ].join("\n"),
  );
  await writeProtected(
    path.join(sqlDir, "role-password.sql"),
    `ALTER ROLE "${applicationRole}" PASSWORD '${applicationPassword}';`,
  );
  await writeProtected(
    path.join(sqlDir, "sentinel.sql"),
    [
      "REVOKE ALL ON SCHEMA public FROM PUBLIC;",
      "CREATE TABLE passvero_stage13a_proof_sentinel (run_id_hash text PRIMARY KEY);",
      `INSERT INTO passvero_stage13a_proof_sentinel (run_id_hash) VALUES ('${runIdHash}');`,
    ].join("\n"),
  );
}

const EXPECTED_PROOF_TABLES = [
  "User",
  "AuthIdentity",
  "AccountActivation",
  "AuthCredentialToken",
  "AuthAbuseBucket",
  "ProofMarker",
  "AuthProviderUser",
  "AuthProviderSession",
  "AuthProviderAccount",
  "AuthProviderVerification",
] as const;

export function validateGeneratedSql(source: string): void {
  if (/\/\*/u.test(source) || /\*\//u.test(source)) {
    fail("generated SQL block comments are unsupported");
  }
  const lines = source.split("\n");
  const normalized = lines.map((line, index) => {
    const comment = line.indexOf("--");
    if (comment === -1) return line;
    if (line.slice(0, comment).trim().length !== 0) {
      fail("generated SQL inline comments are unsupported");
    }
    if (!/^\s*-- (?:CreateEnum|CreateTable|CreateIndex|AddForeignKey|AlterTable)\s*$/u.test(line)) {
      fail("generated SQL comment form is unsupported");
    }
    const previous = lines.slice(0, index).reverse().find((candidate) => candidate.trim().length > 0)?.trim() ?? "";
    const next = lines.slice(index + 1).find((candidate) => candidate.trim().length > 0)?.trim() ?? "";
    if (/\bCREATE$/iu.test(previous) || /^TABLE\b/iu.test(next)) {
      fail("generated SQL comments may not separate CREATE TABLE tokens");
    }
    return "";
  }).join("\n");
  const createTable = /\bCREATE\s+((?:(?:GLOBAL|LOCAL)\s+)?(?:TEMPORARY|TEMP|UNLOGGED)\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([^\s(;,]+)/giu;
  const commands = [...normalized.matchAll(createTable)];
  if (commands.some((match) => match[1] || match[2])) {
    fail("generated SQL table declarations must use plain CREATE TABLE");
  }
  const declarations = commands.map((match) => match[3]);
  if (declarations.length !== EXPECTED_PROOF_TABLES.length) {
    fail("generated SQL must contain the exact table count");
  }
  const names = declarations.map((declaration) => {
    const quoted = declaration.match(/^"([A-Za-z][A-Za-z0-9]*)"$/u);
    if (!quoted) fail("generated SQL table names must be exact quoted unqualified identifiers");
    return quoted[1];
  });
  if (new Set(names).size !== names.length) fail("generated SQL contains a duplicate table");
  const expected = new Set<string>(EXPECTED_PROOF_TABLES);
  for (const name of names) if (!expected.delete(name)) fail("generated SQL contains an unexpected table");
  if (expected.size !== 0) fail("generated SQL is missing an expected table");
}

function asEvidenceDraft(value: unknown): Omit<ProofEvidence, "cleanup"> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("pending evidence must be an object");
  }
  if (Object.hasOwn(value, "cleanup")) fail("pending evidence must not contain cleanup");
  const draft = value as Omit<ProofEvidence, "cleanup">;
  const restoreCounts = (counts: unknown): unknown => {
    if (counts === null || typeof counts !== "object" || Array.isArray(counts)) return counts;
    const record = counts as Readonly<Record<string, unknown>>;
    if (!Object.hasOwn(record, "credentialRecord") || Object.hasOwn(record, "credentialToken")) return counts;
    const { credentialRecord, ...rest } = record;
    return { ...rest, credentialToken: credentialRecord };
  };
  if (!Array.isArray(draft.hypotheses)) fail("pending hypotheses must be an array");
  return {
    ...draft,
    hypotheses: draft.hypotheses.map((hypothesis) => ({
      ...hypothesis,
      before: restoreCounts(hypothesis.before),
      after: restoreCounts(hypothesis.after),
      deltas: restoreCounts(hypothesis.deltas),
    })) as ProofEvidence["hypotheses"],
  };
}

function assertOwnedRealDirectory(candidate: string, label: string): string {
  if (!path.isAbsolute(candidate)) fail(`${label} must be absolute`);
  const status = lstatSync(candidate);
  if (status.isSymbolicLink() || !status.isDirectory()) fail(`${label} must be a non-symlink directory`);
  if (typeof process.getuid !== "function" || status.uid !== process.getuid()) fail(`${label} owner mismatch`);
  const resolved = realpathSync(candidate);
  if (resolved !== candidate) fail(`${label} must already be a real path`);
  return resolved;
}

export async function prepareCleanupEvidence(
  pendingPath: string,
  outputDirectory: string,
  evidenceDirectory: string,
): Promise<void> {
  const evidenceRoot = assertOwnedRealDirectory(evidenceDirectory, "evidence directory");
  if (pendingPath !== path.join(evidenceRoot, "evidence.pending.json")) {
    fail("pending evidence path is not authoritative");
  }
  assertProtectedFile(pendingPath, "pending evidence");
  const pending = asEvidenceDraft(JSON.parse(readFileSync(pendingPath, "utf8")) as unknown);
  renderEvidenceJson({ ...pending, cleanup: {} });
  renderEvidenceMarkdown({ ...pending, cleanup: {} });
  const attemptRoot = assertProtectedDirectory(
    path.join(evidenceRoot, ATTEMPT_STATE_NAME),
    "attempt state directory",
  );
  if (outputDirectory !== path.join(attemptRoot, "prepared")) {
    fail("prepared evidence path is not authoritative");
  }
  await mkdir(outputDirectory, { mode: 0o700 });
  const preparedRoot = assertProtectedDirectory(outputDirectory, "prepared evidence directory");
  for (let mask = 0; mask < 16; mask += 1) {
    const cleanup = {
      serverStopped: Boolean(mask & 8),
      listenerGone: Boolean(mask & 4),
      pidGone: Boolean(mask & 2),
      rootGone: Boolean(mask & 1),
    };
    const evidence = { ...pending, status: "FAIL", cleanup } as ProofEvidence & { readonly status: "FAIL" };
    const suffix = mask.toString(2).padStart(4, "0");
    await writeProtected(path.join(preparedRoot, `fail-${suffix}.json`), renderEvidenceJson(evidence));
    await writeProtected(path.join(preparedRoot, `fail-${suffix}.md`), renderEvidenceMarkdown(evidence));
  }
  const success = {
    ...pending,
    status: "PASS",
    cleanup: { serverStopped: true, listenerGone: true, pidGone: true, rootGone: true },
  } as ProofEvidence & { readonly status: "PASS" };
  await writeProtected(path.join(preparedRoot, "pass-1111.json"), renderEvidenceJson(success));
  await writeProtected(path.join(preparedRoot, "pass-1111.md"), renderEvidenceMarkdown(success));
  const mandatoryIds = new Set<ProofEvidence["hypotheses"][number]["id"]>([
    "H1_NATIVE_TRANSACTION", "H2_DIRECT_API_OUTER_TRANSACTION", "H3_HANDLER_CONTEXT_REPLACEMENT",
    "H4_CONTROLLED_ACTIVATION", "H5_SESSION_COOKIE_AFTER_COMMIT", "H6_RECOVERY_AND_REVOCATION",
    "H7_ROUTE_EXPOSURE",
  ]);
  const observedIds = new Set(pending.hypotheses.map((hypothesis) => hypothesis.id));
  const mandatoryPassed = pending.hypotheses.length === mandatoryIds.size
    && observedIds.size === mandatoryIds.size
    && [...mandatoryIds].every((id) => observedIds.has(id))
    && pending.hypotheses.every((hypothesis) => parseHypothesisAssertionResult(hypothesis) !== null);
  await writeProtected(path.join(preparedRoot, "mandatory-verdict"), mandatoryPassed ? "PASS" : "FAIL");
}

export function selectCleanupEvidenceCandidate(
  proofExitStatus: number,
  mandatoryHypothesesPassed: boolean,
  cleanup: { readonly serverStopped: boolean; readonly listenerGone: boolean; readonly pidGone: boolean; readonly rootGone: boolean },
): `pass-1111` | `fail-${string}` {
  if (!Number.isSafeInteger(proofExitStatus) || proofExitStatus < 0) fail("proof exit status is invalid");
  const suffix = [cleanup.serverStopped, cleanup.listenerGone, cleanup.pidGone, cleanup.rootGone]
    .map((value) => value ? "1" : "0")
    .join("");
  return proofExitStatus === 0 && mandatoryHypothesesPassed && suffix === "1111" ? "pass-1111" : `fail-${suffix}`;
}

function isHypothesisId(value: string): value is HypothesisId {
  return (REQUIRED_HYPOTHESIS_IDS as readonly string[]).includes(value);
}

export async function writeHypothesisResult(
  result: HypothesisAssertionResult | HypothesisFailureResult,
): Promise<void> {
  const parsed = parseHypothesisResult(result);
  if (!parsed) fail("hypothesis result is invalid");
  const identity = readRunIdentity();
  const directory = assertProtectedDirectory(
    path.join(identity.runRoot, "evidence-fragments"),
    "evidence fragments",
  );
  await writeProtected(path.join(directory, `${parsed.id}.json`), `${JSON.stringify(parsed)}\n`);
}

export async function writeHypothesisAssertionResult(result: HypothesisAssertionResult): Promise<void> {
  await writeHypothesisResult(result);
}

export async function recordHypothesisProcessFailure(id: string, processExitCode: number): Promise<void> {
  if (!isHypothesisId(id)) fail("hypothesis result id is invalid");
  if (!Number.isSafeInteger(processExitCode) || processExitCode <= 0 || processExitCode > 255) {
    fail("hypothesis process exit code is invalid");
  }
  const identity = readRunIdentity();
  const directory = assertProtectedDirectory(
    path.join(identity.runRoot, "process-failures"),
    "process failures",
  );
  const result = {
    id,
    status: "FAIL",
    processExitCode,
    failureCode: "STOP_HYPOTHESIS_PROCESS_CRASH",
  } satisfies HypothesisProcessFailure;
  await writeProtected(path.join(directory, `${id}.json`), `${JSON.stringify(result)}\n`);
}

function sha256File(filePath: string): string {
  const status = lstatSync(filePath);
  if (status.isSymbolicLink() || !status.isFile()) fail("hash input must be a regular non-symlink file");
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readProtectedJsonDirectory(runRoot: string, name: string): readonly unknown[] {
  const directory = assertProtectedDirectory(path.join(runRoot, name), name);
  return readdirSync(directory, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) return null;
    const filePath = path.join(directory, entry.name);
    assertProtectedFile(filePath, name);
    try { return JSON.parse(readFileSync(filePath, "utf8")) as unknown; } catch { return null; }
  });
}

export function validateRecordedHypothesisResult(
  id: string,
  expectedStatus: "PASS" | "FAIL" = "PASS",
): HypothesisAssertionResult | HypothesisFailureResult {
  if (!isHypothesisId(id)) fail("hypothesis result id is invalid");
  const identity = readRunIdentity();
  const results = readProtectedJsonDirectory(identity.runRoot, "evidence-fragments");
  const parsed = results.map(parseHypothesisResult);
  if (parsed.some((result) => result === null)) {
    fail("hypothesis assertion result is missing, duplicate, malformed, or conflicting");
  }
  const matching = parsed.filter(
    (result): result is HypothesisAssertionResult | HypothesisFailureResult => result !== null && result.id === id,
  );
  if (matching.length !== 1) fail("hypothesis assertion result is missing, duplicate, malformed, or conflicting");
  if (matching[0].status !== expectedStatus) {
    fail("hypothesis assertion result status conflicts with process exit status");
  }
  return matching[0];
}

export async function aggregateProofEvidence(
  pendingPath: string,
  evidenceDirectory: string,
): Promise<void> {
  const identity = readRunIdentity();
  const evidenceRoot = assertOwnedRealDirectory(evidenceDirectory, "evidence directory");
  if (pendingPath !== path.join(evidenceRoot, "evidence.pending.json")) {
    fail("pending evidence path is not authoritative");
  }
  if (lstatExists(pendingPath)) fail("pending evidence already exists");
  const harnessRoot = assertProtectedDirectory(path.join(identity.runRoot, "harness"), "harness root");
  const candidates = [
    ...readProtectedJsonDirectory(identity.runRoot, "evidence-fragments"),
    ...readProtectedJsonDirectory(identity.runRoot, "process-failures"),
  ];
  const hypotheses = aggregateHypothesisProcessResults(candidates);
  const evidence: Omit<ProofEvidence, "cleanup"> = {
    packageHashes: {
      harnessLockfile: sha256File(path.join(harnessRoot, "package-lock.json")),
      betterAuthPackage: sha256File(path.join(harnessRoot, "node_modules", "better-auth", "package.json")),
      betterAuthCorePackage: sha256File(path.join(harnessRoot, "node_modules", "@better-auth", "core", "package.json")),
      prismaAdapterPackage: sha256File(path.join(harnessRoot, "node_modules", "@better-auth", "prisma-adapter", "package.json")),
    },
    clusterIdHash: readProtectedFile(path.join(identity.runRoot, "identity", "run-id-hash"), "run id hash"),
    postgresVersionHash: sha256File(path.join(identity.runRoot, "data", "PG_VERSION")),
    systemIdentifierHash: readProtectedFile(
      path.join(identity.runRoot, "identity", "system-identifier-hash"),
      "system identifier hash",
    ),
    hypotheses,
    assertions: [
      "each reviewed hypothesis suite was invoked at most once in one disposable cluster",
      "process output remained inside the disposable root and only redacted verdicts were aggregated",
    ],
  };
  await writeProtected(pendingPath, renderPendingEvidenceJson(evidence));
}

function lstatExists(candidate: string): boolean {
  try {
    lstatSync(candidate);
    return true;
  } catch (error: unknown) {
    return !(error instanceof Error && "code" in error && error.code === "ENOENT");
  }
}

function fail(message: string): never {
  throw new Error(`STOP_RUN_ROOT_INVALID: ${message}`);
}

function assertProtectedDirectory(candidate: string, label: string): string {
  if (!path.isAbsolute(candidate)) fail(`${label} must be absolute`);
  let linkStatus: ReturnType<typeof lstatSync>;
  try {
    linkStatus = lstatSync(candidate);
  } catch {
    fail(`${label} is unavailable`);
  }
  if (linkStatus.isSymbolicLink()) fail(`${label} must not be a symlink`);
  const resolved = realpathSync(candidate);
  if (resolved !== candidate) fail(`${label} must already be a real path`);
  const status = statSync(resolved);
  if (!status.isDirectory()) fail(`${label} must be a directory`);
  if (typeof process.getuid !== "function" || status.uid !== process.getuid()) {
    fail(`${label} owner mismatch`);
  }
  if ((status.mode & 0o777) !== 0o700) fail(`${label} mode must be 0700`);
  return resolved;
}

function assertProtectedFile(filePath: string, label: string): void {
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(filePath);
  } catch {
    fail(`${label} is unavailable`);
  }
  if (status.isSymbolicLink() || !status.isFile()) fail(`${label} must be a regular non-symlink file`);
  if (typeof process.getuid !== "function" || status.uid !== process.getuid()) fail(`${label} owner mismatch`);
  if ((status.mode & 0o777) !== 0o600) fail(`${label} mode must be 0600`);
}

function readProtectedFile(filePath: string, label: string): string {
  assertProtectedFile(filePath, label);
  const raw = readFileSync(filePath, "utf8");
  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (value.length === 0 || value.includes("\n") || value.includes("\r")) {
    fail(`${label} must contain exactly one non-empty canonical line`);
  }
  return value;
}

function readIdentityValue(identityDir: string, name: (typeof IDENTITY_NAMES)[number]): string {
  return readProtectedFile(path.join(identityDir, name), `identity/${name}`);
}

export function validateDisposableHarnessEnvironment(candidate = process.cwd()): string {
  if (!STATIC_HARNESS_PATTERN.test(candidate) && !LIVE_HARNESS_PATTERN.test(candidate)) {
    fail("harness root path does not match an approved disposable prefix");
  }
  const harnessRoot = assertProtectedDirectory(candidate, "harness root");
  const cacheDir = assertProtectedDirectory(path.join(harnessRoot, "cache"), "harness cache");
  const tempDir = assertProtectedDirectory(path.join(harnessRoot, "tmp"), "harness temp directory");
  assertProtectedFile(path.join(harnessRoot, "npmrc"), "harness npm user config");
  if (process.env.XDG_CACHE_HOME !== cacheDir) fail("XDG cache must equal the validated harness cache");
  if (process.env.npm_config_cache !== cacheDir) fail("npm cache must equal the validated harness cache");
  if (process.env.TMPDIR !== tempDir) fail("TMPDIR must equal the validated harness temp directory");
  if (process.env.npm_config_userconfig !== path.join(harnessRoot, "npmrc")) {
    fail("npm user config must be inside the validated harness root");
  }
  return harnessRoot;
}

export function readRunIdentity(): RunIdentity {
  const configuredRoot = process.env.PASSVERO_PROOF_RUN_ROOT;
  if (!configuredRoot) fail("PASSVERO_PROOF_RUN_ROOT is required");
  if (!RUN_ROOT_PATTERN.test(configuredRoot)) fail("run-root path does not match the proof prefix");

  const runRoot = assertProtectedDirectory(configuredRoot, "run root");
  const identityDir = assertProtectedDirectory(path.join(runRoot, "identity"), "identity directory");
  const values = Object.fromEntries(
    IDENTITY_NAMES.map((name) => [name, readIdentityValue(identityDir, name)]),
  ) as Record<(typeof IDENTITY_NAMES)[number], string>;

  if (!/^pvproof_admin_[a-f0-9]{12}$/.test(values["superuser-role"])) {
    fail("superuser role is invalid");
  }
  if (!/^pvproof_app_[a-f0-9]{12}$/.test(values["application-role"])) {
    fail("application role is invalid");
  }
  if (!ROLE_PATTERN.test(values["superuser-role"]) || !ROLE_PATTERN.test(values["application-role"])) {
    fail("role is invalid");
  }
  if (!DATABASE_PATTERN.test(values.database)) fail("database name is invalid");
  if (!BASE64URL_48.test(values["superuser-password"])) fail("superuser credential is invalid");
  if (!BASE64URL_48.test(values["application-password"])) fail("application credential is invalid");
  if (values.port !== "55432") fail("port must be 55432");

  const socketDir = assertProtectedDirectory(values["socket-dir"], "socket directory");
  if (path.dirname(socketDir) !== runRoot) fail("socket directory must be directly inside run root");

  return {
    runRoot,
    superuserRole: values["superuser-role"],
    superuserPassword: values["superuser-password"],
    applicationRole: values["application-role"],
    applicationPassword: values["application-password"],
    database: values.database,
    port: 55432,
    socketDir,
  };
}

export function buildConnectionString(identity: RunIdentity): string {
  const scheme = "postgresql:";
  const authority = `${encodeURIComponent(identity.applicationRole)}:${encodeURIComponent(identity.applicationPassword)}@127.0.0.1:${identity.port}`;
  return `${scheme}//${authority}/${encodeURIComponent(identity.database)}?sslmode=disable`;
}

export function readAuthSecret(identity: RunIdentity): string {
  const secretPath = path.join(identity.runRoot, "identity", "auth-secret");
  const secret = readProtectedFile(secretPath, "auth secret");
  if (!BASE64URL_48.test(secret)) fail("auth secret is invalid");
  return secret;
}

async function runCli(): Promise<void> {
  if (process.argv[2] === "bootstrap" && process.argv.length === 4) {
    await bootstrapRunRoot(process.argv[3]);
    return;
  }
  if (process.argv[2] === "validate-generated-sql" && process.argv.length === 4) {
    validateGeneratedSql(readFileSync(process.argv[3], "utf8"));
    return;
  }
  if (process.argv[2] === "prepare-cleanup-evidence" && process.argv.length === 5) {
    fail("prepare-cleanup-evidence requires an authoritative evidence directory");
  }
  if (process.argv[2] === "prepare-cleanup-evidence" && process.argv.length === 6) {
    await prepareCleanupEvidence(process.argv[3], process.argv[4], process.argv[5]);
    return;
  }
  if (process.argv[2] === "record-process-failure" && process.argv.length === 5) {
    await recordHypothesisProcessFailure(process.argv[3], Number(process.argv[4]));
    return;
  }
  if (process.argv[2] === "validate-hypothesis-result" && process.argv.length === 5
    && (process.argv[4] === "PASS" || process.argv[4] === "FAIL")) {
    validateRecordedHypothesisResult(process.argv[3], process.argv[4]);
    return;
  }
  if (process.argv[2] === "aggregate-proof-evidence" && process.argv.length === 5) {
    await aggregateProofEvidence(process.argv[3], process.argv[4]);
    return;
  }
  fail("usage: run-root.ts <bootstrap|validate-generated-sql|prepare-cleanup-evidence|record-process-failure|validate-hypothesis-result|aggregate-proof-evidence|claim-proof-attempt|finalize-proof-attempt> ...");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  await runCli();
}
