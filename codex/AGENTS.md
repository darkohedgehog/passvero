# Passvero — Codex Instructions

This repository contains **Passvero**, a multilingual SaaS platform for creating, managing and publishing Digital Product Passports.

Codex must read this file before making changes.

## Product scope

Passvero is built for small and medium-sized manufacturers, importers and distributors.

The platform will allow organizations to:

- create structured product records;
- generate public Digital Product Passport pages;
- generate QR codes that point to public passports;
- upload compliance documents, manuals and certificates;
- manage product versions and publication state;
- support multiple European languages;
- track passport scans and basic analytics;
- later add subscriptions, team roles and integrations.

## Current phase

The project is in the foundation phase.

Current priorities:

1. internationalization;
2. application architecture;
3. marketing landing page;
4. authentication and organization onboarding;
5. product management;
6. public product passports;
7. QR generation;
8. document uploads;
9. billing and plan limits.

Do not implement later phases unless the active task explicitly requests them.

## Required stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- next-intl
- PostgreSQL
- Prisma
- Zod
- React Hook Form
- shadcn/ui where appropriate

## General rules

- Use strict TypeScript.
- Never use `any`.
- Prefer Server Components by default.
- Use Client Components only when browser state, event handlers or hooks require them.
- Keep components small and focused.
- Keep business logic outside React components.
- Keep database access inside server-only modules.
- Validate all external input with Zod.
- Never expose server secrets to the browser.
- Never trust a company, user or product ID supplied by the client.
- Check organization ownership for every private mutation and query.
- Preserve existing behavior unless the task explicitly changes it.
- Do not refactor unrelated code.
- Do not add dependencies without a clear need.
- Do not claim checks passed unless they were actually run.
- Do not leave placeholder comments such as `TODO` unless the task explicitly allows them.

## Required reading

Before implementing a task, inspect the relevant files in `codex/`.

At minimum read:

- `codex/PROJECT_CONTEXT.md`
- `codex/ARCHITECTURE.md`
- `codex/CODING_STANDARDS.md`
- `codex/TESTING.md`

For localization tasks also read:

- `codex/I18N.md`

For UI work also read:

- `codex/UI_GUIDELINES.md`

For security-sensitive work also read:

- `codex/SECURITY.md`

## Task execution workflow

1. Inspect the current repository and installed package versions.
2. Read the relevant `codex/` documentation.
3. Summarize the implementation plan.
4. Implement only the requested scope.
5. Run lint, type checking, tests and production build where applicable.
6. Report:
   - files created;
   - files modified;
   - checks run;
   - exact results;
   - assumptions;
   - unresolved issues.

## Verification commands

Prefer existing scripts from `package.json`.

Typical checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

When no `typecheck` script exists:

```bash
npx tsc --noEmit
```

Never report success if a relevant command failed.
