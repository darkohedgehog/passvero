# Pre-Phase-9 Dependency Security Remediation Plan

> **Execution:** Use `superpowers:executing-plans`. Work only in the dedicated branch/worktree and stop at every stated gate.

**Goal:** Reduce the current npm audit findings with the smallest compatible dependency patches while preserving the verified production PrismaPg prerequisite and keeping Prisma 7.8.0 unchanged.

**Scope:** Dependency analysis, narrowly selected package/lockfile updates, clean-install verification, regression suites, security review, and evidence. This is not Phase 9 and authorizes no database connection, deployment, environment, PM2, schema, migration, or application-runtime change.

**Starting point:** `main` and `origin/main` at `5c293c072f22a82921ec66d5ca034717b083e678`; branch `chore/pre-phase9-dependency-security-remediation`; worktree `/private/tmp/passvero-pre-phase9-dependency-security`.

## Fixed constraints

- Never run `npm audit fix --force`, `npm update`, `npm upgrade`, or an uncontrolled broad install.
- Keep `prisma`, `@prisma/client`, and `@prisma/adapter-pg` on 7.8.0-compatible declarations and resolutions.
- Do not add arbitrary transitive overrides. Retain or amend an existing scoped override only when the owning direct dependency cannot select the patched package and compatibility is proven by the complete verification suite.
- Do not connect any test or command to production PostgreSQL. Integration tests may run only when an existing safe `TEST_DATABASE_URL` path is available.
- Do not modify source code, Prisma schema/migrations/configuration, environment files, generated Prisma sources, deployment files, PM2, VPS state, or credentials.
- Do not merge, push, or execute Phase 9.

## Checkpoint 1: Freeze and classify the baseline

- Verify the branch/worktree, starting commit, clean primary `main`, and `main == origin/main`.
- Run a secret-free `npm ci`; record `package.json` and lockfile hashes.
- Capture `npm audit --json` and `npm audit --omit=dev --json`.
- For every reported package, capture `npm ls`, `npm explain`, declared ranges, resolved versions, minimum patched versions, and production/runtime reachability.
- Confirm authoritative Next advisories affecting 16.2.10 are all fixed by 16.2.11.
- Confirm the supported Prisma parent release needed to eliminate the `@prisma/dev` chain and document it without changing Prisma.

**Stop:** If any Next advisory affecting 16.2.10 requires newer than 16.2.11, if the baseline differs materially from the stated 12/10 findings, or if the worktree/package lock is already dirty.

## Checkpoint 2: Capture regression baseline

Run before dependency edits:

- `npm run test:application`
- `npm run test:schema`
- `npm run test:infrastructure`
- `node --test tests/production-prisma-runtime-boundaries.test.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npm run test:integration` only if the existing safe test configuration is available; never substitute `DATABASE_URL`.

**Stop:** Any unexplained baseline failure or any attempt to reach production.

## Checkpoint 3: Apply the minimum reviewed patches

- Patch `next` and matching `eslint-config-next` from 16.2.10 to 16.2.11.
- Re-resolve the Next tree before changing its transitive packages.
- If Next 16.2.11 still resolves vulnerable PostCSS or Sharp, update only the existing `next`-scoped override to the minimum compatible patched versions proven by advisory and package metadata.
- Allow Nano ID to resolve to its minimum patched 3.x version only through PostCSS's compatible declared range; do not add it as a direct dependency.
- Keep the Prisma 7.8.0 toolchain unchanged. Record its CLI-only findings as a separate Prisma 7.9.1 upgrade task when the supported parent fix cannot be obtained on 7.8.0.
- Do not force dev-only ESLint transitive findings through new overrides; classify them unless an owning direct patch naturally resolves them.
- Regenerate `package-lock.json` using only package-specific install commands and inspect every changed version, resolution, integrity, and production/dev flag.

**Stop:** Any Prisma version movement, unrelated lockfile drift, need for an unproven override, architecture/source change, or a package resolution outside the reviewed set.

## Checkpoint 4: Prove clean installation and behavior

- Run a clean, secret-free `npm ci` and prove postinstall Prisma generation succeeds without a database URL.
- Run `npm ls` for all changed and remaining vulnerable packages and confirm a valid tree.
- Run all Checkpoint 2 suites again, plus `npx prisma generate`, `npx prisma validate`, and `git diff --check`.
- Run integration tests only through the safe existing `TEST_DATABASE_URL` path if available.

**Stop:** Any regression, secret-dependent generation, invalid tree, or unexpected generated/tracked output.

## Checkpoint 5: Audit, review, and commit

- Re-run both npm audits and compare exact before/after counts and paths.
- Verify no compatible patched production-runtime high-severity finding remains.
- Review the manifest and lockfile for minimality, duplicate packages, unexpected scripts, registry/integrity changes, and unrelated churn.
- Review runtime reachability of every remaining finding; confirm the Prisma CLI package is not imported by application runtime code.
- Run a secret scan and a scoped security/architecture review. Fix all Critical/Important findings in scope.
- Commit the plan and dependency remediation as focused commits. Do not merge or push.

**Completion:** Report exact remaining findings rather than optimizing for a zero count. The task is complete only when Next 16.2.10 findings and all compatible-patch production-runtime high findings are removed without Prisma or architecture drift.
