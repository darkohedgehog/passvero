import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REVIEWED_HARNESS_LOCKFILE_SHA256 =
  "afc199a95a6c0de4fc98a61d14f04093436dc10f1d86b2c371afef5a2815fd27";

export const REVIEWED_INSTALLED_SOURCE_HASHES = new Map([
  ["node_modules/@better-auth/prisma-adapter/dist/index.mjs", "166a05554f2e9fef2bf632a9aced0f328b0ffeb15e0ef2bbc8eeecc80e2ff145"],
  ["node_modules/@better-auth/core/src/db/adapter/index.ts", "8af87bd29365918a42d8d745dcf8acb2439066a1577ac53de17a799194da48dd"],
  ["node_modules/@better-auth/core/src/db/adapter/factory.ts", "f95d88b4f17dd39b2b932cb2649718fbad9d40ff279aa8bc46e1503d33b7cd5d"],
  ["node_modules/@better-auth/core/src/context/transaction.ts", "911e287b36b08b5ee4ca3fa2d30e926c6418f3c2ebf902bded85a577d0729117"],
  ["node_modules/@better-auth/core/dist/utils/url.mjs", "2267b3ac785e7e513790b62347679e011dfea10e173c52dd32d0d1d694c664fe"],
  ["node_modules/@better-auth/core/package.json", "2e154d4f7ba0ca6b6acf6714c8dccf529aaace552833f114d615ce01b3db610e"],
  ["node_modules/better-auth/dist/auth/base.mjs", "64fd12c2e1857b57e9e872f6e5fbc424a909624750b9fbaf4b3d57e3869ba93a"],
  ["node_modules/better-auth/dist/api/to-auth-endpoints.mjs", "bdd6ee0fee9dd3c0467c26c86612f74750d1618bbec1f1421c575efb7e468ea6"],
  ["node_modules/better-auth/dist/db/with-hooks.mjs", "e5f739e10ef22701814e7fd61b92118e3a757c8aa8f28783a691f5ff9d4084a8"],
  ["node_modules/better-auth/dist/api/index.mjs", "4913065fe270292704f4e2874a207c2396845e4b15dadd1623aae9d734e4e0ef"],
  ["node_modules/better-auth/dist/cookies/index.mjs", "945bbb0bd0d77240bc74315c58f5ca74a62165ef605e30dfb336b34c0120665a"],
  ["node_modules/better-auth/dist/api/dispatch.mjs", "18567f3d00a505d912edf655d881695302aefce4ab641648a5ef67452c04c1b0"],
  ["node_modules/better-auth/dist/api/routes/sign-up.mjs", "2b0415e806b5306bf7de9974b1fe31ebdb09401d7042a18a995b9f952edd0fc3"],
  ["node_modules/better-auth/dist/api/routes/sign-in.mjs", "948cc7b1abc1f239378d934f9386a4b539c5cfdde60a326148e93dd40e39feef"],
  ["node_modules/better-auth/dist/api/routes/password.mjs", "a2c44c376d1aba333161d3b9cc688e1cab6522b14d895f61382f1a8e31620286"],
  ["node_modules/better-auth/dist/api/routes/session.mjs", "831a00b6e144c1560c21406de1db586a67089630ad58fb2f3c7dcd3c5c963d57"],
  ["node_modules/better-auth/dist/api/routes/update-user.mjs", "c4993821a1895ee5260f87ee50f8bb8762b450923e7a133edeb3f91d5ba15744"],
  ["node_modules/@better-auth/core/src/api/index.ts", "3eab3ac214b7d20b5e2c46d94b3c766c46408cf1348af4871ed4ec55cccf5c2e"],
  ["node_modules/better-auth/dist/plugins/anonymous/index.mjs", "dd66d20b7b65d3fd18ccd6734dddd3ae5d79c30644fb952b651809604d0a9ac4"],
]);

function stop(message) {
  throw new Error(`STOP_SOURCE_DRIFT: ${message}`);
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertHarnessRoot(candidate) {
  if (!/^\/private\/tmp\/passvero-stage13a-(?:harness\.[A-Za-z0-9]+|pg\.[A-Za-z0-9]+\/harness)$/u.test(candidate)) {
    stop("installed harness path is outside the disposable proof roots");
  }
  const status = lstatSync(candidate);
  if (status.isSymbolicLink() || !status.isDirectory() || realpathSync(candidate) !== candidate) {
    stop("installed harness root is not one real directory");
  }
  if (typeof process.getuid !== "function" || status.uid !== process.getuid() || (statSync(candidate).mode & 0o777) !== 0o700) {
    stop("installed harness ownership or mode is invalid");
  }
  return candidate;
}

function assertReviewedFile(harnessRoot, relativePath, expectedHash) {
  if (!relativePath.startsWith("node_modules/") || path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    stop("reviewed source contract contains an invalid relative path");
  }
  if (!/^[a-f0-9]{64}$/u.test(expectedHash)) stop("reviewed source contract contains an invalid digest");
  const candidate = path.join(harnessRoot, relativePath);
  const status = lstatSync(candidate);
  if (status.isSymbolicLink() || !status.isFile() || realpathSync(candidate) !== candidate) {
    stop("reviewed installed source is not one real file");
  }
  if (sha256(candidate) !== expectedHash) stop("reviewed installed source hash mismatch");
}

function verifyInstalledSourceContractUnchecked(harnessRoot, contract) {
  const root = assertHarnessRoot(harnessRoot);
  if (!contract || !/^[a-f0-9]{64}$/u.test(contract.lockfileSha256) || !(contract.sources instanceof Map)) {
    stop("installed source contract is malformed");
  }
  const lockfilePath = path.join(root, "package-lock.json");
  const lockfileStatus = lstatSync(lockfilePath);
  if (lockfileStatus.isSymbolicLink() || !lockfileStatus.isFile() || realpathSync(lockfilePath) !== lockfilePath) {
    stop("installed harness lockfile is not one real file");
  }
  if (sha256(lockfilePath) !== contract.lockfileSha256) stop("installed harness lockfile hash mismatch");
  if (contract.sources.size === 0) stop("installed source contract is empty");
  for (const [relativePath, expectedHash] of contract.sources) {
    assertReviewedFile(root, relativePath, expectedHash);
  }
}

export function verifyInstalledSourceContract(harnessRoot, contract) {
  try {
    verifyInstalledSourceContractUnchecked(harnessRoot, contract);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("STOP_SOURCE_DRIFT:")) throw error;
    stop("installed source contract could not be verified");
  }
}

export function verifyInstalledSourceIntegrity(harnessRoot, expectedLockfileHash) {
  if (expectedLockfileHash !== REVIEWED_HARNESS_LOCKFILE_SHA256) {
    stop("runner lockfile digest differs from the reviewed contract");
  }
  verifyInstalledSourceContract(harnessRoot, {
    lockfileSha256: REVIEWED_HARNESS_LOCKFILE_SHA256,
    sources: REVIEWED_INSTALLED_SOURCE_HASHES,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  if (process.argv.length !== 5 || process.argv[2] !== "verify") {
    stop("usage: source-integrity.mjs verify <harness-root> <lockfile-sha256>");
  }
  verifyInstalledSourceIntegrity(process.argv[3], process.argv[4]);
}
