import { createHash, randomBytes } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUN_ROOT_PATTERN = /^\/private\/tmp\/passvero-stage13a-pg\.[A-Za-z0-9]+$/;
const STATIC_HARNESS_PATTERN = /^\/private\/tmp\/passvero-stage13a-harness\.[A-Za-z0-9]+$/;
const LIVE_HARNESS_PATTERN = /^\/private\/tmp\/passvero-stage13a-pg\.[A-Za-z0-9]+\/harness$/;
const ROLE_PATTERN = /^pvproof_(?:admin|app)_[a-f0-9]{12}$/;
const DATABASE_PATTERN = /^pvproof_test_[a-f0-9]{12}$/;
const BASE64URL_48 = /^[A-Za-z0-9_-]{48}$/;
export const PROOF_ROOT_SENTINEL = "PASSVERO_STAGE13A_PG_V1";
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
  if (process.argv.length !== 4 || process.argv[2] !== "bootstrap") {
    fail("usage: run-root.ts bootstrap <validated-run-root>");
  }
  await bootstrapRunRoot(process.argv[3]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  await runCli();
}
