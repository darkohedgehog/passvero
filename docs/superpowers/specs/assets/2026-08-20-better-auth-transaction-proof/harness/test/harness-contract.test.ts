import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildConnectionString,
  readAuthSecret,
  readRunIdentity,
  validateDisposableHarnessEnvironment,
} from "../src/run-root.js";
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
