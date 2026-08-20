import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const RUN_ROOT_PATTERN = /^\/private\/tmp\/passvero-stage13a-pg\.[A-Za-z0-9]+$/;
const ROLE_PATTERN = /^pvproof_(?:admin|app)_[a-f0-9]{12}$/;
const DATABASE_PATTERN = /^pvproof_test_[a-f0-9]{12}$/;
const BASE64URL_48 = /^[A-Za-z0-9_-]{48}$/;
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

function fail(message: string): never {
  throw new Error(`STOP_RUN_ROOT_INVALID: ${message}`);
}

function assertProtectedDirectory(candidate: string, label: string): string {
  if (!path.isAbsolute(candidate)) fail(`${label} must be absolute`);
  const linkStatus = lstatSync(candidate);
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

function readIdentityValue(identityDir: string, name: (typeof IDENTITY_NAMES)[number]): string {
  const filePath = path.join(identityDir, name);
  const linkStatus = lstatSync(filePath);
  if (linkStatus.isSymbolicLink() || !linkStatus.isFile()) {
    fail(`identity/${name} must be a regular non-symlink file`);
  }
  const raw = readFileSync(filePath, "utf8");
  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (value.length === 0 || value.includes("\n") || value.includes("\r")) {
    fail(`identity/${name} must contain exactly one non-empty canonical line`);
  }
  return value;
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
  const status = lstatSync(secretPath);
  if (status.isSymbolicLink() || !status.isFile()) fail("auth secret must be a regular non-symlink file");
  const raw = readFileSync(secretPath, "utf8");
  const secret = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (!BASE64URL_48.test(secret)) fail("auth secret is invalid");
  return secret;
}
