# Task 1 report: Better Auth transaction source contract

## Scope

Implemented only `tests/auth-foundation-transaction-proof-source.test.mjs` and
this report. The test uses Node built-ins only (`node:test`, `assert/strict`,
`crypto`, `module`, `fs/promises`, and `path`). It does not initialize Better
Auth, Prisma, dotenv, PostgreSQL, or any application module.

## RED

Command:

```text
node --test tests/auth-foundation-transaction-proof-source.test.mjs
```

Result: FAIL, one test failed with `SOURCE_CONTRACT_NOT_IMPLEMENTED`.

## GREEN

Command:

```text
env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" /opt/homebrew/bin/node --test tests/auth-foundation-transaction-proof-source.test.mjs
```

Result: PASS, one test passed and printed `SOURCE_CONTRACT=PASS`.

The test computes SHA-256 from the sixteen pinned review files, checks the
documented line ranges, checks the required literal source contracts, resolves
`@better-auth/core/context` through `createRequire`, and verifies that
`getCurrentAdapter` and `runWithTransaction` are functions. It also verifies
the reconciled review artifact contains `CLI: auth 1.7.1` and checks installed
versions: Better Auth, its Prisma adapter, and core are `1.7.1`; `@prisma/client`
and `prisma` are `7.8.0`.

Pinned source hashes:

| File | SHA-256 |
| --- | --- |
| `node_modules/@better-auth/prisma-adapter/dist/index.mjs` | `166a05554f2e9fef2bf632a9aced0f328b0ffeb15e0ef2bbc8eeecc80e2ff145` |
| `node_modules/@better-auth/core/src/context/transaction.ts` | `911e287b36b08b5ee4ca3fa2d30e926c6418f3c2ebf902bded85a577d0729117` |
| `node_modules/@better-auth/core/package.json` | `2e154d4f7ba0ca6b6acf6714c8dccf529aaace552833f114d615ce01b3db610e` |
| `node_modules/better-auth/dist/auth/base.mjs` | `64fd12c2e1857b57e9e872f6e5fbc424a909624750b9fbaf4b3d57e3869ba93a` |
| `node_modules/better-auth/dist/api/to-auth-endpoints.mjs` | `bdd6ee0fee9dd3c0467c26c86612f74750d1618bbec1f1421c575efb7e468ea6` |
| `node_modules/better-auth/dist/db/with-hooks.mjs` | `e5f739e10ef22701814e7fd61b92118e3a757c8aa8f28783a691f5ff9d4084a8` |
| `node_modules/better-auth/dist/api/index.mjs` | `4913065fe270292704f4e2874a207c2396845e4b15dadd1623aae9d734e4e0ef` |
| `node_modules/better-auth/dist/cookies/index.mjs` | `945bbb0bd0d77240bc74315c58f5ca74a62165ef605e30dfb336b34c0120665a` |
| `node_modules/better-auth/dist/api/dispatch.mjs` | `18567f3d00a505d912edf655d881695302aefce4ab641648a5ef67452c04c1b0` |
| `node_modules/better-auth/dist/api/routes/sign-up.mjs` | `2b0415e806b5306bf7de9974b1fe31ebdb09401d7042a18a995b9f952edd0fc3` |
| `node_modules/better-auth/dist/api/routes/sign-in.mjs` | `948cc7b1abc1f239378d934f9386a4b539c5cfdde60a326148e93dd40e39feef` |
| `node_modules/better-auth/dist/api/routes/password.mjs` | `a2c44c376d1aba333161d3b9cc688e1cab6522b14d895f61382f1a8e31620286` |
| `node_modules/better-auth/dist/api/routes/session.mjs` | `831a00b6e144c1560c21406de1db586a67089630ad58fb2f3c7dcd3c5c963d57` |
| `node_modules/better-auth/dist/api/routes/update-user.mjs` | `c4993821a1895ee5260f87ee50f8bb8762b450923e7a133edeb3f91d5ba15744` |
| `node_modules/@better-auth/core/src/api/index.ts` | `3eab3ac214b7d20b5e2c46d94b3c766c46408cf1348af4871ed4ec55cccf5c2e` |
| `node_modules/better-auth/dist/plugins/anonymous/index.mjs` | `dd66d20b7b65d3fd18ccd6734dddd3ae5d79c30644fb952b651809604d0a9ac4` |

## Verification and concerns

- `git diff --check` passed.
- No database, PostgreSQL, service, Prisma, npm, config, or environment
  command was run. No package/source/schema/migration/env/generated-client
  file was edited.
- The requested `pgrep -f 'passvero-stage13a-pg'` check was attempted, but the
  container returned `sysmon request failed: sysmond service not found` and
  `pgrep: Cannot get process list`; therefore process absence could not be
  independently observed in this environment.

## Commit

Task content commit before this report metadata update: `910dba8`
(`910dba8cc33001e42e7a625d0ed4ba13e2394688`).

## Fix Round 1

Addressed the review finding in the line-range helper. It now splits the
source into lines and asserts `lines.length >= end` with a
`STOP_SOURCE_DRIFT` message before slicing. A focused one-line fixture proves
that requesting lines 1–2 fails instead of silently truncating.

RED command and result:

```text
node --test tests/auth-foundation-transaction-proof-source.test.mjs
```

Result: FAIL, the fixture assertion reported
`STOP_SOURCE_DRIFT: fixture line range must reject an end beyond EOF` while the
existing source-contract test remained passing.

GREEN command and result:

```text
env -i PATH="/opt/homebrew/bin:/usr/bin:/bin" TMPDIR="/private/tmp" NODE_OPTIONS="--no-warnings" /opt/homebrew/bin/node --test tests/auth-foundation-transaction-proof-source.test.mjs
```

Result: PASS, both tests passed; output included
`SOURCE_CONTRACT=PASS`.

`git diff --check` passed. No database, PostgreSQL, service, Prisma, npm,
config, or environment command was run, and no forbidden file was edited.

Fix Round 1 code commit before this report metadata update:
`761a1ef` (`761a1ef9fd322bbf5cb8cd45f7b3821e31673b43`).
