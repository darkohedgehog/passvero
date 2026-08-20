import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const REVIEW_ROOT = "/private/tmp/passvero-better-auth-review-1-7-1";
const RECONCILED_REVIEW = path.join(
  process.cwd(),
  "docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md",
);
const EXPECTED = new Map([
  ["node_modules/@better-auth/prisma-adapter/dist/index.mjs", "166a05554f2e9fef2bf632a9aced0f328b0ffeb15e0ef2bbc8eeecc80e2ff145"],
  ["node_modules/@better-auth/core/src/context/transaction.ts", "911e287b36b08b5ee4ca3fa2d30e926c6418f3c2ebf902bded85a577d0729117"],
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

const RANGE_ASSERTIONS = [
  {
    file: "node_modules/@better-auth/prisma-adapter/dist/index.mjs",
    start: 170,
    end: 202,
    patterns: [/db\[model\]\.create/, /db\[model\]\.findFirst/],
  },
  {
    file: "node_modules/@better-auth/prisma-adapter/dist/index.mjs",
    start: 415,
    end: 433,
    patterns: [/transaction: config\.transaction \?\? false/, /prisma\.\$transaction/],
  },
  {
    file: "node_modules/@better-auth/core/src/context/transaction.ts",
    start: 36,
    end: 190,
    patterns: [/getCurrentAdapter/, /runWithTransaction/, /store\?\.isTransactionActive/],
  },
  {
    file: "node_modules/@better-auth/core/package.json",
    start: 31,
    end: 57,
    patterns: [/"\.\/context"/],
  },
  {
    file: "node_modules/better-auth/dist/auth/base.mjs",
    start: 17,
    end: 40,
    patterns: [/runWithAdapter\(handlerCtx\.adapter/],
  },
  {
    file: "node_modules/better-auth/dist/api/to-auth-endpoints.mjs",
    start: 34,
    end: 55,
    patterns: [/dispatchAuthEndpoint/],
  },
  {
    file: "node_modules/better-auth/dist/db/with-hooks.mjs",
    start: 4,
    end: 77,
    patterns: [/getCurrentAdapter/],
  },
  {
    file: "node_modules/better-auth/dist/api/index.mjs",
    start: 84,
    end: 166,
    patterns: [/disabledPaths\.includes/],
  },
  {
    file: "node_modules/better-auth/dist/cookies/index.mjs",
    start: 167,
    end: 180,
    patterns: [/setSessionCookie/],
  },
  {
    file: "node_modules/better-auth/dist/api/routes/sign-up.mjs",
    start: 143,
    end: 269,
    patterns: [/disableSignUp/, /createSession/, /setSessionCookie/, /internalAdapter\.createUser/],
  },
  {
    file: "node_modules/better-auth/dist/api/routes/sign-in.mjs",
    start: 307,
    end: 368,
    patterns: [/createSession/, /setSessionCookie/],
  },
  {
    file: "node_modules/better-auth/dist/api/routes/password.mjs",
    start: 21,
    end: 175,
    patterns: [/consumeVerificationValue/, /deleteUserSessions/],
  },
  {
    file: "node_modules/@better-auth/core/src/api/index.ts",
    start: 169,
    end: 215,
    patterns: [/createAuthEndpoint\.serverOnly/, /SERVER_ONLY/],
  },
  {
    file: "node_modules/better-auth/dist/plugins/anonymous/index.mjs",
    start: 80,
    end: 91,
    patterns: [/internalAdapter\.createUser/, /createSession/],
  },
];

const PACKAGE_VERSIONS = new Map([
  ["better-auth", "1.7.1"],
  ["@better-auth/prisma-adapter", "1.7.1"],
  ["@better-auth/core", "1.7.1"],
  ["@prisma/client", "7.8.0"],
  ["prisma", "7.8.0"],
]);

function stop(message, cause) {
  const error = new Error(`STOP_SOURCE_DRIFT: ${message}`);
  if (cause) error.cause = cause;
  return error;
}

function assertSource(condition, message) {
  assert.ok(condition, `STOP_SOURCE_DRIFT: ${message}`);
}

test("freezes the Better Auth transaction source contract", async () => {
  try {
    const sources = new Map();
    for (const [relativePath, expectedHash] of EXPECTED) {
      const source = await readFile(path.join(REVIEW_ROOT, relativePath), "utf8");
      const actualHash = createHash("sha256").update(source).digest("hex");
      assertSource(actualHash === expectedHash, `${relativePath} hash mismatch`);
      sources.set(relativePath, source);
    }

    for (const { file, start, end, patterns } of RANGE_ASSERTIONS) {
      const source = sources.get(file);
      const selectedLines = source.split("\n").slice(start - 1, end).join("\n");
      assertSource(selectedLines.length > 0, `${file} lines ${start}-${end} are missing`);
      for (const pattern of patterns) {
        assert.match(
          selectedLines,
          pattern,
          `STOP_SOURCE_DRIFT: ${file} lines ${start}-${end} missing ${pattern}`,
        );
      }
    }

    const reviewRequire = createRequire(`${REVIEW_ROOT}/package.json`);
    const coreContext = reviewRequire("@better-auth/core/context");
    assert.equal(
      typeof coreContext.getCurrentAdapter,
      "function",
      "STOP_SOURCE_DRIFT: @better-auth/core/context getCurrentAdapter export missing",
    );
    assert.equal(
      typeof coreContext.runWithTransaction,
      "function",
      "STOP_SOURCE_DRIFT: @better-auth/core/context runWithTransaction export missing",
    );

    for (const [packageName, expectedVersion] of PACKAGE_VERSIONS) {
      const packageJson = JSON.parse(
        await readFile(
          path.join(REVIEW_ROOT, "node_modules", packageName, "package.json"),
          "utf8",
        ),
      );
      assertSource(
        packageJson.version === expectedVersion,
        `${packageName} version is ${packageJson.version}, expected ${expectedVersion}`,
      );
    }

    const reviewArtifact = await readFile(RECONCILED_REVIEW, "utf8");
    assert.match(
      reviewArtifact,
      /^- CLI: auth 1\.7\.1$/m,
      "STOP_SOURCE_DRIFT: reconciled review artifact is missing CLI: auth 1.7.1",
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("STOP_SOURCE_DRIFT:")) {
      throw error;
    }
    throw stop("source contract could not be evaluated", error);
  }

  console.log("SOURCE_CONTRACT=PASS");
});
