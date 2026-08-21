import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

const HARNESS_ROOT = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness",
);
const PROOF_ROOT = path.dirname(HARNESS_ROOT);
const PROOF_ROOT_RELATIVE = path.relative(process.cwd(), PROOF_ROOT);
const EVIDENCE_JSON = path.join(PROOF_ROOT, "evidence.json");
const EVIDENCE_MARKDOWN = path.join(PROOF_ROOT, "evidence.md");
const FOUNDATION_REVIEW = path.join(
  process.cwd(),
  "docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md",
);
const MIGRATION_CONTRACT = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md",
);

const REQUIRED_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "prisma.config.ts",
  "src/run-root.ts",
  "src/auth.ts",
  "src/proof-boundary.ts",
  "src/evidence.ts",
  "src/lifecycle.ts",
  "src/publication.mjs",
  "src/source-integrity.mjs",
  "test/harness-contract.test.ts",
  "test/cluster-identity.test.ts",
  "test/native-transaction.test.ts",
  "test/direct-boundary.test.ts",
  "test/handler-boundary.test.ts",
  "test/controlled-activation.test.ts",
  "test/session-boundary.test.ts",
  "test/recovery-boundary.test.ts",
  "test/route-boundary.test.ts",
];

const TASK_5_ARTIFACT_HASHES = new Map([]);

const TASK_6_ARTIFACT_HASHES = new Map([]);
const TASK_6_CONTROLLED_AUTH_SLICE_HASH = "4358e1f3e4c262f877684073aa748395e6ede8753f966b9219624716b6b47e02";

const TASK_7_ARTIFACT_HASHES = new Map([
  ["src/proof-boundary.ts", "0fbd71e24fbb96f646d84b2275aaa56ddf65113380a902904ac901010973a0e1"],
]);

const TASK_8_ARTIFACT_HASHES = new Map([]);
const TASK_8_AUTH_PREFIX_HASH = "5f62090e132f5f6ad0e379ccc8928087a562a3cf798b9bc16420bb6139efccc9";

const TASK_9_ARTIFACT_HASHES = new Map([
  ["src/auth.ts", "4090e54fb2b726459080b792d8469fd5f7b77c025b2d644513dee5604d13f2ab"],
]);

const TASK_10_ORCHESTRATION_HASHES = new Map([
  ["src/evidence.ts", "1af09dfa57c99fa5275b7310af6dfff96e6ed6be8c6c85dec903ccf082f43f44"],
  ["src/run-root.ts", "81bed5424a0890633d063d3f0a19ddc647d49a0cc9d3441561823f78641c0d08"],
  ["src/publication.mjs", "d61ffb689c6c5d437306ad0fa943546869db68099fe39e58b468b3dae350b005"],
  ["src/lifecycle.ts", "8d5f22bfa631d132664f6833365113e3f8638be3d06c85080a67ff03acce8f5c"],
  ["src/source-integrity.mjs", "b9b7308e458a6363041cbc65eb94eee39deda69f1c44122c502cae30492bb984"],
  ["test/harness-contract.test.ts", "285e04f693fc5df43ef100e38b554d6f372f37d4406f4d607ce1ec24936a70c1"],
  ["test/direct-boundary.test.ts", "5f6100dbf8bd6c07d95a1ff7ba17283d371c59c108555ae04c0ad08e0cbd8dc7"],
  ["test/handler-boundary.test.ts", "e91ff34540943448e4f4cdccfa95064867c701e876921c1caec09f1c7c679501"],
  ["test/controlled-activation.test.ts", "06420fea8cfd17d9f85a0af53a20d6aed3f00c385b367a15d5358ef1dda5cd7a"],
  ["test/session-boundary.test.ts", "c827336807319d5b49c0d1ffb46cfca8fb21fa3bb0d092d23cbf1a84481e6f32"],
  ["test/recovery-boundary.test.ts", "9f2c27ca7f2271c1931a30cdabddcbcc8484b86ed9c136acd3056eadf3461736"],
  ["test/route-boundary.test.ts", "43d7b7d0412b9d447431d8b6d1678e810e6f10c0e6634bf96650aee2a0d9a855"],
]);
const TASK_10_EXECUTED_ORCHESTRATION_HASHES = new Map([
  ["src/run-root.ts", "a977c4df5c8754f02149c13852db5250cbabdf24806e3da57524a4952f33bfda"],
  ["test/harness-contract.test.ts", "b61eeda3136f937fb034f9612099f74da3bc7c82b4b38996f270fe87cb82d769"],
  ["test/session-boundary.test.ts", "7a54228f168829f72c169c48ab15dab7f916825f26897b81d79972eba6f273b7"],
]);
const TASK_10_EXECUTED_NATIVE_TRANSACTION_HASH =
  "e83a2cf4537e51345781d0999bd89d58b6f29a34e83528fc4a2357065ae118ba";
const TASK_10_POST_PROOF_LINT_SUCCESSOR_NATIVE_TRANSACTION_HASH =
  "e378998b921151c79594ba0ca0aa044b001a550173f56d9813f845cbe8143401";
const TASK_10_EXECUTED_RUNNER_HASH = "214bfc8806bba13da533908a6179335592da44d9f1e302395fc75df8f8183a56";
const TASK_10_RUNNER_HASH = "7716a7d703659517d521896fa7dc5711f8bde98e64d08258d3dd9103199b81c0";
const TASK_10_SHELL_SIMULATION_HASH = "aeacc38f11cac1094befafb422b824bba521c1676d4e5e3bfa76e57b35bdb8a8";
const TASK_10_FAILURE_EVIDENCE_JSON_HASH = "a266b49904e2e6f6cf3d479cf9424fcc35fdbe0fd744b73d864f5e052f162b8a";
const TASK_10_FAILURE_EVIDENCE_MARKDOWN_HASH = "4777abc2d84e60d8a6f7a0dae5d93d2275543aff928ee8f3e6aa747078213a43";
const REVIEWED_HARNESS_LOCKFILE_HASH = "afc199a95a6c0de4fc98a61d14f04093436dc10f1d86b2c371afef5a2815fd27";

const REQUIRED_HYPOTHESIS_IDS = [
  "H1_NATIVE_TRANSACTION",
  "H2_DIRECT_API_OUTER_TRANSACTION",
  "H3_HANDLER_CONTEXT_REPLACEMENT",
  "H4_CONTROLLED_ACTIVATION",
  "H5_SESSION_COOKIE_AFTER_COMMIT",
  "H6_RECOVERY_AND_REVOCATION",
  "H7_ROUTE_EXPOSURE",
];

const EXPECTED_DEPENDENCIES = {
  "@better-auth/core": "1.7.1",
  "@better-auth/prisma-adapter": "1.7.1",
  "@prisma/adapter-pg": "7.8.0",
  "@prisma/client": "7.8.0",
  "better-auth": "1.7.1",
  "pg": "8.16.3",
};

const EXPECTED_DEV_DEPENDENCIES = {
  prisma: "7.8.0",
  tsx: "4.20.6",
  typescript: "5.9.2",
};

const EXPECTED_DISABLED_PATHS = [
  "/account-info", "/callback/:id", "/change-email", "/change-password",
  "/delete-user", "/delete-user/callback", "/error", "/get-access-token",
  "/get-session", "/link-social", "/list-accounts", "/list-sessions", "/ok",
  "/refresh-token", "/request-password-reset", "/reset-password",
  "/reset-password/:token", "/revoke-other-sessions", "/revoke-session",
  "/revoke-sessions", "/send-verification-email", "/sign-in/email",
  "/sign-in/social", "/sign-out", "/sign-up/email", "/unlink-account",
  "/update-session", "/update-user", "/verify-email", "/verify-password",
];

const GENERATED_PROVIDER_SCHEMA = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma",
);

const FORBIDDEN = [
  /postgresql:\/\//i,
  /postgres:\/\//i,
  /DATABASE_URL=/,
  /TEST_DATABASE_URL=/,
  /Set-Cookie:/i,
  /token=/i,
  /password=/i,
  /\/Users\//,
];

async function readHarness(relativePath) {
  return readFile(path.join(HARNESS_ROOT, relativePath), "utf8");
}

function modelBlock(source, name) {
  const match = source.match(new RegExp(`model ${name} \\{[\\s\\S]*?^\\}`, "m"));
  assert.ok(match, `missing model ${name}`);
  return match[0];
}

test("the deterministic proof harness has the complete pinned artifact map", async () => {
  const sources = new Map();
  for (const relativePath of REQUIRED_FILES) {
    sources.set(relativePath, await readHarness(relativePath));
  }

  const manifest = JSON.parse(sources.get("package.json"));
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.deepEqual(manifest.dependencies, EXPECTED_DEPENDENCIES);
  assert.deepEqual(manifest.devDependencies, EXPECTED_DEV_DEPENDENCIES);

  const lockfile = JSON.parse(sources.get("package-lock.json"));
  assert.equal(
    createHash("sha256").update(sources.get("package-lock.json")).digest("hex"),
    REVIEWED_HARNESS_LOCKFILE_HASH,
  );
  assert.equal(lockfile.lockfileVersion, 3);
  assert.deepEqual(lockfile.packages[""].dependencies, EXPECTED_DEPENDENCIES);
  assert.deepEqual(lockfile.packages[""].devDependencies, EXPECTED_DEV_DEPENDENCIES);

  for (const [relativePath, expectedHash] of TASK_5_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 5 proof`,
    );
  }
  for (const [relativePath, expectedHash] of TASK_6_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 6 proof`,
    );
  }
  const task6AuthStart = sources.get("src/auth.ts").indexOf(
    "export const H4_CONTROLLED_ACTIVATION_RUNTIME_VERDICT",
  );
  const task6AuthEnd = sources.get("src/auth.ts").indexOf("export interface CreateProofAuthInput");
  assert.ok(task6AuthStart >= 0, "Task 6 auth body missing");
  assert.ok(task6AuthEnd > task6AuthStart, "Task 6 controlled auth slice end missing");
  assert.equal(
    createHash("sha256").update(
      sources.get("src/auth.ts").slice(task6AuthStart, task6AuthEnd),
    ).digest("hex"),
    TASK_6_CONTROLLED_AUTH_SLICE_HASH,
    "Task 6 controlled activation body drifted while Task 8 extended the auth factory",
  );
  for (const [relativePath, expectedHash] of TASK_7_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 7 proof`,
    );
  }
  for (const [relativePath, expectedHash] of TASK_8_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 8 proof`,
    );
  }
  const task8AuthEnd = sources.get("src/auth.ts").indexOf("function proofAuthOptions");
  assert.ok(task8AuthEnd > 0, "Task 8 auth prefix end missing");
  assert.equal(
    createHash("sha256").update(sources.get("src/auth.ts").slice(0, task8AuthEnd)).digest("hex"),
    TASK_8_AUTH_PREFIX_HASH,
    "Task 8 recovery and controlled-auth prefix drifted while Task 9 extended route policy",
  );
  for (const [relativePath, expectedHash] of TASK_9_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 9 proof`,
    );
  }
  for (const [relativePath, expectedHash] of TASK_10_ORCHESTRATION_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 10 orchestration`,
    );
  }
  for (const [relativePath, executedHash] of TASK_10_EXECUTED_ORCHESTRATION_HASHES) {
    assert.notEqual(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      executedHash,
      `${relativePath} final-review successor must not be represented as historically executed`,
    );
  }
  const nativeTransactionSource = sources.get("test/native-transaction.test.ts");
  const nativeTransactionHash = createHash("sha256")
    .update(nativeTransactionSource)
    .digest("hex");
  assert.equal(
    nativeTransactionHash,
    TASK_10_POST_PROOF_LINT_SUCCESSOR_NATIVE_TRANSACTION_HASH,
    "post-proof lint successor drifted from the authorized semantics-preserving correction",
  );
  assert.notEqual(
    nativeTransactionHash,
    TASK_10_EXECUTED_NATIVE_TRANSACTION_HASH,
    "post-proof lint successor must not be represented as the historically executed source",
  );
  assert.match(nativeTransactionSource, /const proxy: T = new Proxy\(client, \{/);
  assert.doesNotMatch(nativeTransactionSource, /let proxy: T;\s*proxy = new Proxy\(client, \{/);

  const prismaConfig = sources.get("prisma.config.ts");
  assert.doesNotMatch(prismaConfig, /dotenv/);
  assert.doesNotMatch(prismaConfig, /process\.env\.(?:DATABASE_URL|TEST_DATABASE_URL)/);
  assert.doesNotMatch(prismaConfig, /(?:\.\.\/){2,}/);

  for (const [relativePath, source] of sources) {
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(source, pattern, `${relativePath} contains forbidden ${pattern}`);
    }
  }

  for (const relativePath of [
    "prisma.config.ts",
    "src/auth.ts",
    "src/proof-boundary.ts",
  ]) {
    assert.match(
      sources.get(relativePath),
      /readRunIdentity\(/,
      `${relativePath} must fail closed through readRunIdentity()`,
    );
  }
});

test("the proof attempt state is protected by one exact anchored local ignore rule", async () => {
  const ignore = await readFile(path.join(PROOF_ROOT, ".gitignore"), "utf8");
  assert.equal(ignore, "/.proof-attempt-state/\n");
  const syntheticPath = path.join(PROOF_ROOT_RELATIVE, ".proof-attempt-state", "synthetic-ignore-guard.json");
  const ignored = spawnSync("git", ["check-ignore", "--no-index", "--verbose", syntheticPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.match(ignored.stdout, /\.gitignore:1:\/\.proof-attempt-state\/\s/);
  assert.match(ignored.stdout, /synthetic-ignore-guard\.json\s*$/);
});

test("installed source verification fails closed on lockfile and reviewed-source drift", async () => {
  const modulePath = path.join(HARNESS_ROOT, "src", "source-integrity.mjs");
  const {
    REVIEWED_HARNESS_LOCKFILE_SHA256,
    REVIEWED_INSTALLED_SOURCE_HASHES,
    verifyInstalledSourceContract,
  } = await import(pathToFileURL(modulePath).href);
  assert.equal(REVIEWED_HARNESS_LOCKFILE_SHA256, REVIEWED_HARNESS_LOCKFILE_HASH);
  assert.equal(REVIEWED_INSTALLED_SOURCE_HASHES.size, 19);
  assert.equal(
    REVIEWED_INSTALLED_SOURCE_HASHES.get("node_modules/@better-auth/prisma-adapter/dist/index.mjs"),
    "166a05554f2e9fef2bf632a9aced0f328b0ffeb15e0ef2bbc8eeecc80e2ff145",
  );
  const fixture = await mkdtemp("/private/tmp/passvero-stage13a-harness.");
  await chmod(fixture, 0o700);
  const reviewedPath = path.join(fixture, "node_modules", "reviewed", "source.mjs");
  const lockfilePath = path.join(fixture, "package-lock.json");
  const lockfile = "reviewed-lockfile\n";
  const source = "export const reviewed = true;\n";
  await mkdir(path.dirname(reviewedPath), { recursive: true, mode: 0o700 });
  await writeFile(lockfilePath, lockfile, { mode: 0o600 });
  await writeFile(reviewedPath, source, { mode: 0o600 });
  const contract = {
    lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
    sources: new Map([
      ["node_modules/reviewed/source.mjs", createHash("sha256").update(source).digest("hex")],
    ]),
  };
  try {
    assert.doesNotThrow(() => verifyInstalledSourceContract(fixture, contract));
    await writeFile(lockfilePath, "drifted-lockfile\n", { mode: 0o600 });
    assert.throws(() => verifyInstalledSourceContract(fixture, contract), /STOP_SOURCE_DRIFT/);
    await writeFile(lockfilePath, lockfile, { mode: 0o600 });
    await writeFile(reviewedPath, "export const reviewed = false;\n", { mode: 0o600 });
    assert.throws(() => verifyInstalledSourceContract(fixture, contract), /STOP_SOURCE_DRIFT/);
    await rm(reviewedPath);
    assert.throws(() => verifyInstalledSourceContract(fixture, contract), /STOP_SOURCE_DRIFT/);
  } finally {
    await rm(fixture, { recursive: true });
  }
});

test("the disposable schema is the exact reviewed provider schema plus approved proof fields", async () => {
  const schema = await readHarness("prisma/schema.prisma");
  const generated = await readFile(GENERATED_PROVIDER_SCHEMA, "utf8");
  assert.equal(
    createHash("sha256").update(schema).digest("hex"),
    "ebf7514192aafc2b8208e6a8bc906f4c275271600ca9d60e159c2fdc72f10be3",
  );

  const expectedUser = modelBlock(generated, "AuthProviderUser").replace(
    "  authprovideraccounts AuthProviderAccount[]",
    "  authprovideraccounts AuthProviderAccount[]\n  credentialTokens     AuthCredentialToken[] @relation(\"AuthProviderUserCredentialTokens\")",
  );
  assert.equal(modelBlock(schema, "AuthProviderUser"), expectedUser);

  const expectedSession = modelBlock(generated, "AuthProviderSession")
    .replace(
      "  authenticatedAt        DateTime\n  selectedOrganizationId String?",
      "  authenticatedAt        DateTime\n  lastRefreshAt          DateTime\n  selectedOrganizationId String?",
    )
    .replace("  @@index([userId])", "  @@index([userId])\n  @@index([lastRefreshAt])");
  assert.equal(modelBlock(schema, "AuthProviderSession"), expectedSession);
  assert.equal(
    modelBlock(schema, "AuthProviderAccount"),
    modelBlock(generated, "AuthProviderAccount"),
  );
  assert.equal(
    modelBlock(schema, "AuthProviderVerification"),
    modelBlock(generated, "AuthProviderVerification"),
  );

  assert.deepEqual(
    [...schema.matchAll(/^model (\w+) /gm)].map((match) => match[1]),
    [
      "User", "AuthIdentity", "AccountActivation", "AuthCredentialToken",
      "AuthAbuseBucket", "ProofMarker", "AuthProviderUser", "AuthProviderSession",
      "AuthProviderAccount", "AuthProviderVerification",
    ],
  );
  assert.deepEqual(
    [...schema.matchAll(/^enum (\w+) /gm)].map((match) => match[1]),
    ["AuthCredentialTokenPurpose", "AuthAbuseDimension"],
  );
});

test("the Better Auth factory freezes the approved security and route surface", async () => {
  const source = await readHarness("src/auth.ts");
  for (const contract of [
    /baseURL: "https:\/\/auth-proof\.invalid\/internal-auth"/,
    /basePath: "\/internal-auth"/,
    /transaction: input\.adapterTransaction/,
    /disableSignUp: input\.disableSignUp/,
    /requireEmailVerification: true/,
    /autoSignIn: false/,
    /revokeSessionsOnPasswordReset: true/,
    /disableSessionRefresh: true/,
    /cookieCache: \{ enabled: false \}/,
    /enabled: false,\s*disableImplicitLinking: true/,
    /useSecureCookies: true/,
    /secure: true,\s*httpOnly: true,\s*sameSite: "lax"/,
    /authenticatedAt: \{ type: "date", required: true, input: false \}/,
    /lastRefreshAt: \{ type: "date", required: true, input: false \}/,
    /selectedOrganizationId: \{ type: "string", required: false, input: false \}/,
  ]) assert.match(source, contract);

  const list = source.match(/DISABLED_NATIVE_PATHS = \[([\s\S]*?)\] as const/)?.[1];
  assert.ok(list, "disabled native path list missing");
  assert.deepEqual([...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]), EXPECTED_DISABLED_PATHS);
});

test("proof sources forbid direct provider writes, any, and premature cookie exposure", async () => {
  const sourceNames = [
    "src/auth.ts", "src/evidence.ts", "src/proof-boundary.ts", "src/run-root.ts",
    "test/session-boundary.test.ts", "test/recovery-boundary.test.ts",
    "test/route-boundary.test.ts",
  ];
  const sources = await Promise.all(sourceNames.map(readHarness));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /\bas\s+any\b|:\s*any\b|<any>/, `${sourceNames[index]} contains any`);
    assert.doesNotMatch(
      source,
      /\.authProvider(?:User|Account|Session|Verification)\.(?:create|update|delete|upsert)\b/,
      `${sourceNames[index]} contains a direct provider write`,
    );
  }

  const boundary = sources[2];
  assert.doesNotMatch(boundary, /auth\.handler/);
  assert.doesNotMatch(boundary, /rootPrisma\.(?!\$transaction)/);
  assert.match(boundary, /const pending = await input\.rootPrisma\.\$transaction/);
  assert.match(boundary, /prisma: tx,\s*adapterTransaction: false/);
  assert.match(boundary, /runWithTransaction\(adapter/);
  assert.match(boundary, /pending\.capturedHeaders\.splice\(0, pending\.capturedHeaders\.length\)/);
  assert.match(boundary, /adapter\.incrementOne<SessionProofRecord>\(\{[\s\S]*?increment: \{\},[\s\S]*?set: \{[\s\S]*?token: input\.rotatedToken,[\s\S]*?expiresAt,[\s\S]*?lastRefreshAt: input\.now/);
  assert.match(boundary, /\{ field: "id", operator: "eq"[\s\S]*?\{ field: "token", operator: "eq"[\s\S]*?\{ field: "expiresAt", operator: "gt"[\s\S]*?\{ field: "lastRefreshAt", operator: "gt"[\s\S]*?\{ field: "authenticatedAt", operator: "gt"/);
  assert.doesNotMatch(boundary, /NO_SUPPORTED_ATOMIC_SESSION_ROTATION/);
  const sessionBoundary = sources[4];
  assert.match(sessionBoundary, /const stored = \{ \.\.\.callerSnapshot, token: "newer-database-token" \}/);
  assert.match(sessionBoundary, /for \(const \[deadline, stored\] of \[[\s\S]*?"EXPIRY"[\s\S]*?"INACTIVITY"[\s\S]*?"ABSOLUTE"/);
  assert.match(sessionBoundary, /assert\.equal\(guarded\.calls\.length, 1, deadline\)/);
  assert.match(sessionBoundary, /for \(const deadline of \["EXPIRY", "INACTIVITY", "ABSOLUTE"\] as const\)/);
  assert.match(sessionBoundary, /assert\.equal\(guardLoss\.cookie\.present, false, deadline\)/);
  const recoveryBoundary = sources[5];
  assert.match(recoveryBoundary, /changePasswordWithBetterAuthAuthority/);
  assert.match(recoveryBoundary, /Promise\.all\(\[consume\(\), consume\(\)\]\)/);
  assert.match(recoveryBoundary, /"AFTER_CONSUME", "AFTER_CREDENTIAL_UPDATE", "AFTER_PARTIAL_SESSION_DELETION", "IN_TRANSACTION_CALLBACK"/);
  assert.match(recoveryBoundary, /requiresSignIn: true, sessionCreated: false, cookieEligible: false/);
  assert.match(recoveryBoundary, /skip: process\.env\.PASSVERO_PROOF_H6 !== "1"/);
  assert.match(recoveryBoundary, /const generated: unknown = await import\(generatedPath\)/);
  assert.match(recoveryBoundary, /Promise\.all\(\[verifyCall\("a"\), verifyCall\("b"\)\]\)/);
  assert.match(recoveryBoundary, /Promise\.all\(\[resetCall\("a"\), resetCall\("b"\)\]\)/);
  assert.match(recoveryBoundary, /updateManyAndReturn/);
  assert.match(recoveryBoundary, /runWithTransaction\(hookContext\.adapter/);
  assert.match(recoveryBoundary, /accountUpdateAfter: \(\) => \{ throw new Error\("INJECTED_H6_QUEUED_HOOK_FAILURE"\); \}/);
  assert.match(recoveryBoundary, /auth\.api\.changePasswordCredentialProof/);
  assert.match(recoveryBoundary, /Promise\.allSettled\(\[changeCall\("a"\), changeCall\("b"\)\]\)/);
  assert.match(recoveryBoundary, /h6DatabaseLeakScan/);
  assert.match(recoveryBoundary, /STOP_H6_SECRET_LEAK/);
  assert.doesNotMatch(recoveryBoundary, /console\.(?:log|error|warn|info)/);
  const auth = sources[0];
  assert.match(auth, /randomBytes\(CREDENTIAL_CAPABILITY_BYTES\)/);
  assert.match(auth, /passvero-auth-credential-capability/);
  assert.match(auth, /passvero-auth-credential-target-email/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /model: "session"[\s\S]*?sortBy: \{ field: "id", direction: "asc" \}/);
  assert.match(auth, /status: "OPERATIONAL_FAILURE"[\s\S]*?category: "RECOVERY_AFTER_COMMIT_HOOK_FAILED"/);
  assert.match(auth, /type RecoveryInternalAdapter = Pick<[\s\S]*?AuthContext\["internalAdapter"\]/);
  assert.match(auth, /createAuthEndpoint\.serverOnly/);
  assert.match(auth, /ctx\.context\.internalAdapter/);
  assert.match(auth, /changePasswordCredentialProof: createAuthEndpoint\.serverOnly/);
  assert.match(auth, /changePasswordWithBetterAuthAuthority/);
  assert.match(auth, /disabledPaths: \[\.\.\.DISABLED_NATIVE_PATHS\]/);
  assert.doesNotMatch(auth, /PRODUCTION_DISABLED_NATIVE_PATHS|ENCODED_DYNAMIC_NATIVE_PATHS/);
  const httpBoundaryStart = auth.indexOf("export function handlePassveroAuthHttpRequest");
  const httpBoundaryEnd = auth.indexOf("export const DIRECT_SERVER_API_ALLOWLIST", httpBoundaryStart);
  assert.ok(httpBoundaryStart >= 0 && httpBoundaryEnd > httpBoundaryStart);
  const httpBoundary = auth.slice(httpBoundaryStart, httpBoundaryEnd);
  assert.match(httpBoundary, /return new Response\("Not Found", \{ status: PASSVERO_HTTP_AUTH_BOUNDARY\.status \}\)/);
  assert.doesNotMatch(httpBoundary, /auth\.handler|betterAuth\(/);
  assert.doesNotMatch(auth, /console\.(?:log|error|warn|info)/);
  const finalizeIndex = boundary.lastIndexOf("const finalized = finalizeAfterCommit(pending)");
  const afterCommitFailureIndex = boundary.lastIndexOf('injectFailure(input.failurePoint, "AFTER_COMMIT_CALLBACK")');
  const returnIndex = boundary.lastIndexOf("return finalized");
  assert.ok(finalizeIndex > 0 && finalizeIndex < afterCommitFailureIndex);
  assert.ok(afterCommitFailureIndex < returnIndex);

  const directBoundary = await readHarness("test/direct-boundary.test.ts");
  assert.match(directBoundary, /AssertNever<Extract<"handler", keyof DirectAuthApi>>/);
  assert.match(
    directBoundary,
    /return providerUserId;\s*}\s*const canonicalId = await createCanonicalAndAbuse[\s\S]*?failAt\(failurePoint, "AFTER_CANONICAL_WRITE"\);[\s\S]*?const providerUserId = await createProviderCredential[\s\S]*?failAt\(failurePoint, "AFTER_PROVIDER_WRITE"\);[\s\S]*?await linkAndConsumeCredential/,
  );
  assert.match(boundary, /api: DirectAuthApi/);

  const handlerBoundary = await readHarness("test/handler-boundary.test.ts");
  assert.doesNotMatch(handlerBoundary, /providerTransactionIds|instrumentProviderWrites|STOP_H3_TRANSACTION_ID_INVALID/);
});

test("run-root and tool-environment gates encode filesystem ownership and containment", async () => {
  const runRoot = await readHarness("src/run-root.ts");
  const config = await readHarness("prisma.config.ts");
  for (const contract of [
    /status\.uid !== process\.getuid\(\)/,
    /status\.mode & 0o777\) !== 0o600/,
    /status\.mode & 0o777\) !== 0o700/,
    /isSymbolicLink\(\)/,
    /realpathSync\(candidate\)/,
    /XDG cache must equal the validated harness cache/,
    /npm cache must equal the validated harness cache/,
    /TMPDIR must equal the validated harness temp directory/,
    /socket directory must be directly inside run root/,
    /randomBytes\(/,
    /mode: 0o600, flag: "wx"/,
  ]) assert.match(runRoot, contract);
  assert.ok(config.indexOf("validateDisposableHarnessEnvironment();") < config.indexOf("readRunIdentity();"));
});

test("the proof runner encodes a static-only mode and fail-closed PostgreSQL lifecycle", async () => {
  const source = await readFile(path.join(PROOF_ROOT, "run-proof.sh"), "utf8");
  for (const contract of [
    /set -euo pipefail/,
    /umask 077/,
    /\[\[ \$# -eq 1 \]\]/,
    /--static\|--all/,
    /PROOF_PORT=55432/,
    /PG_BIN=\/opt\/homebrew\/opt\/postgresql@16\/bin/,
    /mktemp -d \/private\/tmp\/passvero-stage13a-pg\.XXXXXX/,
    /PASSVERO_STAGE13A_PG_V1/,
    /\/usr\/sbin\/lsof -nP -iTCP:\$\{PROOF_PORT\} -sTCP:LISTEN/,
    /pg_isready" -h 127\.0\.0\.1 -p "\$PROOF_PORT"/,
    /validate_cleanup_target/,
    /trap cleanup EXIT/,
    /trap 'request_signal_failure 130' INT/,
    /trap 'request_signal_failure 143' TERM/,
    /CLEANUP=FAIL_RETAINED/,
    /rm -rf -- "\$RUN_ROOT_REAL"/,
    /prepare-cleanup-evidence/,
    /\.proof-attempt-state/,
    /prove_partial_postmaster/,
    /fs\.lstatSync\(candidate\)/,
    /validate_delete_target/,
    /prearm_root_allocation/,
    /ROOT_ALLOCATION_PENDING/,
    /supervise_publication_child/,
    /PUBLICATION_CHILD_TRUSTED/,
  ]) assert.match(source, contract);

  const staticBody = source.match(/run_static\(\) \{([\s\S]*?)^\}/m)?.[1];
  assert.ok(staticBody, "run_static must be a separately reviewable function");
  assert.doesNotMatch(staticBody, /\b(?:initdb|pg_ctl|createdb|psql)\b|generated\/prisma/);
  assert.match(staticBody, /node_modules\/typescript\/bin\/tsc --noEmit --strict/);
  for (const task5TypeInput of [
    "src/proof-boundary.ts",
    "src/lifecycle.ts",
    "test/native-transaction.test.ts",
    "test/direct-boundary.test.ts",
    "test/handler-boundary.test.ts",
    "test/controlled-activation.test.ts",
    "test/session-boundary.test.ts",
    "test/recovery-boundary.test.ts",
    "test/route-boundary.test.ts",
  ]) {
    assert.match(staticBody, new RegExp(task5TypeInput.replaceAll("/", "\\/\\s*")));
  }

  for (const forbidden of [
    /docker/i,
    /source\s+\.env/,
    /DATABASE_URL/,
    /TEST_DATABASE_URL/,
    /rm -rf \/(?:\s|$)/,
    /rm -rf[^\n]*[*?\[]/,
    /PROOF_PORT\s*=\s*\$\(\(|PROOF_PORT\+\+|55433/,
  ]) assert.doesNotMatch(source, forbidden);

  assert.doesNotMatch(source, /RUN_ROOT_REAL\/prepared-evidence|publish_candidate[^\n]*\|\| true/);
  const publication = await readHarness("src/publication.mjs");
  const markdownPublication = publication.lastIndexOf("await renamePublication(stageMarkdown, finalMarkdown)");
  const jsonPublication = publication.lastIndexOf("await renamePublication(stageJson, finalJson)");
  assert.ok(markdownPublication > 0 && jsonPublication > markdownPublication, "authoritative JSON must publish last");
  assert.match(source, /"\$proof_status" -eq 0 && "\$mandatory_verdict" == PASS && "\$suffix" == 1111/);
  assert.match(source, /mandatory-verdict/);
  const runAllBody = source.match(/run_all\(\) \{([\s\S]*?)^\}/m)?.[1];
  assert.ok(runAllBody, "run_all must be a separately reviewable function");
  assert.doesNotMatch(runAllBody, /prove_h6/);
  assert.match(source, /"\$candidate" != "pass-1111"/);
  assert.match(source, /CLEANUP=FAIL_PROOF_WITH_COMPLETE_CLEANUP/);
  assert.ok(publication.indexOf('await commitFail("fail-1111")') < publication.indexOf("await input.retirePending(pendingPath)"));
  assert.ok(publication.indexOf("await input.retirePending(pendingPath)") < publication.indexOf("await input.inspectPending(pendingPath)"));
  assert.ok(publication.indexOf("await input.inspectPending(pendingPath)") < publication.indexOf("pendingRetired = true"));
  assert.ok(publication.indexOf("pendingRetired = true") < publication.lastIndexOf("await stagePublication(\"pass-1111\")"));
  assert.match(source, /publish_checked_failure "\$candidate" "\$material" "\$pending_arg" "\$failure_status"/);
  assert.match(publication, /FAIL_PENDING_RETAINED/);
  assert.match(source, /CLEANUP=FAIL_PUBLICATION_RECOVERABLE/);
  assert.match(publication, /attempt-claimed\.json/);
  assert.match(publication, /process\.on\("SIGTERM", interrupt\)/);
  assert.match(publication, /assertPublicationAllowed/);
  assert.match(publication, /pre-json-window/);

  const runRoot = await readHarness("src/run-root.ts");
  assert.match(runRoot, /renderEvidenceJson\(\{ \.\.\.pending, cleanup: \{\} \}\)/);
  assert.match(runRoot, /validateGeneratedSql/);
  assert.match(runRoot, /generated SQL must contain the exact table count/);
  assert.match(runRoot, /exact quoted unqualified identifiers/);
  assert.match(source, /node_modules\/prisma\/build\/index\.js" migrate diff/);
  assert.doesNotMatch(source, /npm[^\n]*run schema:sql/);
  assert.match(source, /verify_installed_source_integrity/);
  assert.match(source, /STOP_SOURCE_DRIFT/);
});

test("the one-shot runner aggregates exactly one assertion-bound reviewed H1-H7 verdict", async () => {
  const runner = await readFile(path.join(PROOF_ROOT, "run-proof.sh"), "utf8");
  const shellSimulation = await readFile(path.join(PROOF_ROOT, "static-shell-simulations.sh"), "utf8");
  const evidence = await readHarness("src/evidence.ts");
  const runRoot = await readHarness("src/run-root.ts");
  const contract = await readHarness("test/harness-contract.test.ts");
  const runAll = runner.match(/run_all\(\) \{([\s\S]*?)^\}/m)?.[1];
  const hypotheses = runner.match(/run_hypotheses\(\) \{([\s\S]*?)^\}/m)?.[1];
  assert.ok(runAll, "run_all must remain separately reviewable");
  assert.ok(hypotheses, "run_hypotheses must remain separately reviewable");
  assert.equal(createHash("sha256").update(runner).digest("hex"), TASK_10_RUNNER_HASH);
  assert.notEqual(createHash("sha256").update(runner).digest("hex"), TASK_10_EXECUTED_RUNNER_HASH);
  assert.equal(createHash("sha256").update(shellSimulation).digest("hex"), TASK_10_SHELL_SIMULATION_HASH);
  assert.doesNotMatch(runner, /STOP_HYPOTHESES_NOT_IMPLEMENTED/);
  assert.ok(runAll.indexOf("claim_attempt") < runAll.indexOf("bootstrap_root"));
  assert.ok(runAll.indexOf("bootstrap_root") < runAll.indexOf("start_cluster"));
  const bootstrap = runner.match(/bootstrap_root\(\) \{([\s\S]*?)^\}/m)?.[1];
  assert.ok(bootstrap, "bootstrap_root must remain separately reviewable");
  assert.ok(
    bootstrap.indexOf("verify_installed_source_integrity") < bootstrap.indexOf("PHASE=IDENTITY_CREATED"),
    "installed source integrity must be proven before cluster startup can be reached",
  );
  assert.ok(runAll.indexOf("prove_cluster_identity") < runAll.indexOf("generate_apply_schema"));
  assert.ok(runAll.indexOf("generate_apply_schema") < runAll.indexOf("run_hypotheses"));
  assert.equal((hypotheses.match(/run_hypothesis "/g) ?? []).length, 7);
  for (const contractPattern of [
    /H1_NATIVE_TRANSACTION" "PASSVERO_PROOF_H1"[\s\S]*?native-transaction\.test\.ts/,
    /H2_DIRECT_API_OUTER_TRANSACTION" "PASSVERO_PROOF_H2"[\s\S]*?direct-boundary\.test\.ts/,
    /H3_HANDLER_CONTEXT_REPLACEMENT" "PASSVERO_PROOF_H3"[\s\S]*?handler-boundary\.test\.ts/,
    /H4_CONTROLLED_ACTIVATION" "PASSVERO_PROOF_H4"[\s\S]*?controlled-activation\.test\.ts/,
    /H5_SESSION_COOKIE_AFTER_COMMIT" "PASSVERO_PROOF_H5"[\s\S]*?session-boundary\.test\.ts/,
    /H6_RECOVERY_AND_REVOCATION" "PASSVERO_PROOF_H6"[\s\S]*?recovery-boundary\.test\.ts/,
    /H7_ROUTE_EXPOSURE" "PASSVERO_PROOF_H7"[\s\S]*?route-boundary\.test\.ts/,
  ]) assert.match(hypotheses, contractPattern);
  assert.match(runner, />"\$RUN_ROOT_REAL\/log\/\$id\.log" 2>&1/);
  assert.match(runner, /aggregate-proof-evidence "\$SCRIPT_DIR\/evidence\.pending\.json" "\$SCRIPT_DIR"/);
  assert.match(runner, /STOP_EXECUTION_ATTEMPT_EXISTS/);
  assert.match(evidence, /REQUIRED_HYPOTHESIS_IDS/);
  assert.match(evidence, /STOP_HYPOTHESIS_RESULT_MISSING/);
  assert.match(evidence, /STOP_HYPOTHESIS_RESULT_DUPLICATE/);
  assert.match(evidence, /STOP_HYPOTHESIS_PROCESS_CRASH/);
  assert.match(runRoot, /writeProtected\(path\.join\(directory, `\$\{parsed\.id\}\.json`\)/);
  assert.match(runRoot, /validateRecordedHypothesisResult/);
  assert.match(runRoot, /renderPendingEvidenceJson\(evidence\)/);
  for (const simulation of [
    "accepts exactly seven unique assertion-bound results",
    "rejects one explicit hypothesis failure",
    "rejects a missing hypothesis result",
    "rejects a duplicate hypothesis result",
    "records a crashed hypothesis process as terminal failure",
    "rejects zero-exit skipped or malformed assertion evidence",
    "attempt claim is atomic",
    "every partial startup phase retains its root",
    "PASS publication rename failure",
  ]) assert.match(contract, new RegExp(simulation));
});

test("session-boundary assertion failures cannot serialize live token or session objects", async () => {
  const source = await readHarness("test/session-boundary.test.ts");
  const liveStart = source.indexOf('test("live H5 uses controlled activation');
  assert.ok(liveStart > 0, "live H5 proof test missing");
  const liveSource = source.slice(liveStart);
  assert.doesNotMatch(liveSource, /assert\.deepEqual\([\s\S]{0,160}sessionByToken\(/);
  assert.match(source, /assertSessionStateUnchanged/);
  assert.match(source, /STOP_H5_SESSION_STATE_DRIFT/);
  assert.match(source, /failure reporting omits protected session values/);
});

test("the historical Stage 13A fix report is prominently superseded", async () => {
  const historicalReport = await readFile(
    path.join(
      process.cwd(),
      ".superpowers/sdd/2026-08-20-passvero-auth-foundation-review/final-fix-report.md",
    ),
    "utf8",
  );
  assert.match(historicalReport.slice(0, 900), /HISTORICAL AND SUPERSEDED/);
  assert.match(historicalReport.slice(0, 900), /ownership-reconciliation-report\.md/);
  assert.match(historicalReport.slice(0, 900), /BLOCKED_PENDING_ARCHITECTURE_REVIEW/);
  assert.match(historicalReport.slice(0, 900), /H1-H7.*NOT_EXECUTED/is);
});

test("the terminal proof reconciliation is deterministic, redacted, and blocks persistence", async () => {
  const [jsonSource, markdown, review, migrationContract] = await Promise.all([
    readFile(EVIDENCE_JSON, "utf8"),
    readFile(EVIDENCE_MARKDOWN, "utf8"),
    readFile(FOUNDATION_REVIEW, "utf8"),
    readFile(MIGRATION_CONTRACT, "utf8"),
  ]);
  assert.equal(
    createHash("sha256").update(jsonSource).digest("hex"),
    TASK_10_FAILURE_EVIDENCE_JSON_HASH,
  );
  assert.equal(
    createHash("sha256").update(markdown).digest("hex"),
    TASK_10_FAILURE_EVIDENCE_MARKDOWN_HASH,
  );

  const evidence = JSON.parse(jsonSource);
  assert.equal(`${JSON.stringify(evidence, null, 2)}\n`, jsonSource);
  assert.deepEqual(Object.keys(evidence), [
    "artifactKind", "generatedByExecutedPublisher", "executionSourceCommit",
    "status", "invocationCount", "retryCount", "failure", "hypotheses", "cleanup",
  ]);
  assert.equal(evidence.artifactKind, "POST_EXECUTION_RECONCILIATION");
  assert.equal(evidence.generatedByExecutedPublisher, false);
  assert.equal(evidence.executionSourceCommit, "d1f350627c3da72feaa18eb5416ff17e07db81a8");
  assert.equal(evidence.status, "FAIL");
  assert.equal(evidence.invocationCount, 1);
  assert.equal(evidence.retryCount, 0);
  assert.deepEqual(evidence.failure, {
    phase: "PRE_HYPOTHESIS_SCHEMA_PREPARATION_INCOMPLETE",
    code: "STOP_PRE_EVIDENCE_FAILURE",
    exactCause: null,
    evidenceLimitation: "EXACT_CAUSE_NOT_RETAINED_IN_COMMITTED_PUBLIC_EVIDENCE",
  });
  assert.deepEqual(evidence.cleanup, {
    status: "FAIL_RETAINED",
    serverStopped: true,
    listenerGone: true,
    pidGone: true,
    rootGone: false,
    retainedRootDisposition:
      "RETAIN_UNCHANGED_PENDING_SEPARATE_EXPLICIT_EXACT_TARGET_AUTHORIZATION_AND_REVIEWED_CLEANUP",
    historicalOutcomeFinal: true,
  });
  assert.deepEqual(evidence.hypotheses.map(({ id }) => id), REQUIRED_HYPOTHESIS_IDS);

  for (const hypothesis of evidence.hypotheses) {
    assert.deepEqual(Object.keys(hypothesis), ["id", "status", "reason", "observations"]);
    assert.equal(hypothesis.status, "NOT_EXECUTED");
    assert.equal(hypothesis.reason, "STOP_PRE_EVIDENCE_FAILURE");
    assert.equal(hypothesis.observations, null);
    for (const syntheticRuntimeKey of [
      "transactionIds", "before", "after", "deltas", "cookie", "assertions", "failureCode",
    ]) assert.equal(Object.hasOwn(hypothesis, syntheticRuntimeKey), false);
  }

  const expectedMarkdown = [
    "# Better Auth transaction proof evidence companion",
    "",
    "POST-EXECUTION RECONCILIATION: this corrected public artifact was not generated",
    "by the publisher executed at `d1f350627c3da72feaa18eb5416ff17e07db81a8`.",
    "Historical execution facts remain pinned to that commit. The later post-proof",
    "`prefer-const` and final-review hardening successors were not executed, and the",
    "proof was not rerun. The final-review successor adds static-only SQL-stream,",
    "installed-source, Git-ignore, and secret-safe assertion guards; it has no",
    "runtime observations or retry authority.",
    "The JSON file is the authoritative corrected public record; this Markdown is",
    "its companion.",
    "",
    "- Overall status: `FAIL`",
    "- Invocation count: `1`",
    "- Retry count: `0`",
    "- Failure phase: `PRE_HYPOTHESIS_SCHEMA_PREPARATION_INCOMPLETE`",
    "- Failure code: `STOP_PRE_EVIDENCE_FAILURE`",
    "- Exact cause: unavailable; it was not retained in committed public evidence",
    "",
    "| Hypothesis | Status | Reason | Runtime observations |",
    "| --- | --- | --- | --- |",
    ...REQUIRED_HYPOTHESIS_IDS.map(
      (id) => `| ${id} | NOT_EXECUTED | STOP_PRE_EVIDENCE_FAILURE | unavailable |`,
    ),
    "",
    "Cleanup status: `FAIL_RETAINED`",
    "",
    "- `serverStopped=true`",
    "- `listenerGone=true`",
    "- `pidGone=true`",
    "- `rootGone=false`",
    "",
    "The retained root remains unchanged. Disposal requires separate explicit",
    "exact-target authorization and a reviewed cleanup procedure. A future disposal",
    "must not rewrite the historical `rootGone=false` value or `FAIL_RETAINED`",
    "cleanup status.",
    "",
  ].join("\n");
  assert.equal(markdown, expectedMarkdown);

  assert.doesNotMatch(jsonSource, /"(?:packageHashes|clusterIdHash|postgresVersionHash|systemIdentifierHash)"/);
  assert.doesNotMatch(jsonSource, /"(?:transactionIds|before|after|deltas|cookie)"/);

  for (const source of [jsonSource, markdown]) {
    for (const forbidden of [
      /(?:https?|postgres(?:ql)?):\/\//i,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /\/(?:Users|private\/tmp)\//,
      /Set-Cookie/i,
      /\b(?:token|password|secret|credential)\s*=/i,
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
      /\b[A-Za-z0-9_-]{43}\b/,
    ]) assert.doesNotMatch(source, forbidden);
  }

  for (const source of [review, migrationContract]) {
    assert.match(
      source,
      /AUTH_FOUNDATION_PERSISTENCE_CONTRACT=BLOCKED_PENDING_ARCHITECTURE_REVIEW/,
    );
    assert.match(source, /STOP_PRE_EVIDENCE_FAILURE/);
    assert.match(source, /NOT_EXECUTED/);
    assert.match(source, /invoked exactly once/i);
    assert.match(source, /retry count is (?:zero|0)/i);
    assert.match(source, /FAIL_RETAINED/);
    assert.match(source, /separate explicit exact-target\s+authorization/i);
    assert.match(source, /TASK_10_LINT_GATE=PASS_POST_PROOF_SUCCESSOR_ONLY/);
    assert.match(source, /historical execution source.*d1f3506/is);
    assert.match(source, /successor (?:source )?was not\s+executed/i);
    assert.match(source, /FINAL_REVIEW_STATIC_SUCCESSOR=UNEXECUTED/);
    assert.doesNotMatch(source, /PostgreSQL connection performed: YES, exactly once/i);
    assert.doesNotMatch(source, /AUTH_FOUNDATION_PERSISTENCE_CONTRACT=APPROVAL_READY/);
    assert.doesNotMatch(source, /BETTER_AUTH_RUNTIME_BOUNDARY=/);
  }
});
