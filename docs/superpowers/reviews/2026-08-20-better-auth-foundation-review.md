# Better Auth Foundation Review

**Status:** Awaiting operator schema decision
**Execution base:** 331f8f1cd29203ee7d8d9364c7324313b75f822f
**Evidence date:** 2026-08-20

## Candidate dependency baseline

- better-auth: 1.7.1
- @better-auth/prisma-adapter: 1.7.1
- Prisma: 7.8.0
- Next.js: 16.2.11
- React: 19.2.4
- Organization plugin: EXCLUDED
- Admin plugin: EXCLUDED
- OAuth plugin: EXCLUDED
- Magic-link plugin: EXCLUDED
- 2FA plugin: EXCLUDED
- Passkey plugin: EXCLUDED
- Redis: EXCLUDED
- Cookie cache: EXCLUDED
- Public signup: EXCLUDED
- Automatic linking: EXCLUDED
- Database connection performed: NO
- Schema or migration modified: NO

## Evidence sources

- npm registry metadata queried on 2026-08-20 with `npm view better-auth version`,
  `npm view @better-auth/prisma-adapter version`, and `npm view auth version`:
  each returned 1.7.1.
- `npm view @better-auth/prisma-adapter peerDependencies --json` accepts Prisma
  major version 7.
- Repository `package.json` and lockfile record Prisma 7.8.0, Next.js 16.2.11,
  and React 19.2.4.
