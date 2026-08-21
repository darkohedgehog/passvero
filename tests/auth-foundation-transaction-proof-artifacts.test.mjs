import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HARNESS_ROOT = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness",
);
const PROOF_ROOT = path.dirname(HARNESS_ROOT);

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
  ["src/evidence.ts", "3cf4d9761aaabff05431e8b3fabb9c04848a692ce3f30ecb04ec3eb60be06aac"],
  ["src/run-root.ts", "318b2a9ac287f7bef5298c2a8fcbd2ddc5a716b6af45f68393f390d9744d617e"],
  ["src/publication.mjs", "d770d64f1c736e4ecc53f799f207b99fd9f13e39a4699a2787bcfe3086e7d380"],
  ["src/lifecycle.ts", "8d5f22bfa631d132664f6833365113e3f8638be3d06c85080a67ff03acce8f5c"],
  ["test/harness-contract.test.ts", "e58eab7f455e51e776822afe7e761008a5bdd74a45d93508dbb556f927330d71"],
  ["test/native-transaction.test.ts", "cf3f1c3ceb8d3faad02d67827e1e57c7eb78c8e3460e9a041db129674ec4d6ba"],
  ["test/direct-boundary.test.ts", "a06015f3ef961e9b837c7d3b244acda1977cc42f5e1c47ac268bbfe20c733cf8"],
  ["test/handler-boundary.test.ts", "34ca19cd9ef2b6de5df2dbcdc9d5583157d142ce5089e2ea6d214f9afa4ccce5"],
  ["test/controlled-activation.test.ts", "24ed1affda81556ae410b84e04bbb729623a8037281c05f0c09717c9aa14f04f"],
  ["test/session-boundary.test.ts", "96fcfbe0dbce37d465e71664fa7d5538a615d51365c560951156e40428b3ab52"],
  ["test/recovery-boundary.test.ts", "8038a38d8b0373ee8407df12e7eeefefdcd96223aac18b11fa939b4ab9320eb9"],
  ["test/route-boundary.test.ts", "c2319423f2bee53beee45753ee3bd7fa1df31f321beddd88f87336a0e5ab9726"],
]);
const TASK_10_RUNNER_HASH = "4b03347d880a665de199b5459b8e11d6a48ca81e3a3ade8413f12f19e99e77da";

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
    /trap 'exit 130' INT/,
    /trap 'exit 143' TERM/,
    /CLEANUP=FAIL_RETAINED/,
    /rm -rf -- "\$RUN_ROOT_REAL"/,
    /prepare-cleanup-evidence/,
    /\.proof-attempt-state/,
    /prove_partial_postmaster/,
    /fs\.lstatSync\(candidate\)/,
    /validate_delete_target/,
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
  assert.ok(publication.indexOf("pendingRetired = true") < publication.lastIndexOf("await stage(\"pass-1111\")"));
  assert.match(source, /publish_checked_failure "\$candidate" "\$material" "\$pending_arg" "\$failure_status"/);
  assert.match(publication, /FAIL_PENDING_RETAINED/);
  assert.match(source, /CLEANUP=FAIL_PUBLICATION_RECOVERABLE/);
  assert.match(publication, /attempt-claimed\.json/);

  const runRoot = await readHarness("src/run-root.ts");
  assert.match(runRoot, /renderEvidenceJson\(\{ \.\.\.pending, cleanup: \{\} \}\)/);
  assert.match(runRoot, /validateGeneratedSql/);
  assert.match(runRoot, /generated SQL must contain the exact table count/);
  assert.match(runRoot, /exact quoted unqualified identifiers/);
});

test("the one-shot runner aggregates exactly one assertion-bound reviewed H1-H7 verdict", async () => {
  const runner = await readFile(path.join(PROOF_ROOT, "run-proof.sh"), "utf8");
  const evidence = await readHarness("src/evidence.ts");
  const runRoot = await readHarness("src/run-root.ts");
  const contract = await readHarness("test/harness-contract.test.ts");
  const runAll = runner.match(/run_all\(\) \{([\s\S]*?)^\}/m)?.[1];
  const hypotheses = runner.match(/run_hypotheses\(\) \{([\s\S]*?)^\}/m)?.[1];
  assert.ok(runAll, "run_all must remain separately reviewable");
  assert.ok(hypotheses, "run_hypotheses must remain separately reviewable");
  assert.equal(createHash("sha256").update(runner).digest("hex"), TASK_10_RUNNER_HASH);
  assert.doesNotMatch(runner, /STOP_HYPOTHESES_NOT_IMPLEMENTED/);
  assert.ok(runAll.indexOf("claim_attempt") < runAll.indexOf("bootstrap_root"));
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
  assert.match(evidence, /STOP_HYPOTHESIS_PROCESS_FAILED/);
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
