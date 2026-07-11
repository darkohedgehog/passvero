# next-intl Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Passvero for statically renderable locale-based routing across six languages with Croatian as the unprefixed default.

**Architecture:** A locale-segment root layout owns the document and validates locale params. Shared next-intl routing, request, and navigation modules centralize locale behavior, while a Next.js 16 proxy handles negotiation and canonicalization.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript 5, Tailwind CSS 4, next-intl 4.13.2

## Global Constraints

- Use strict TypeScript and no `any`.
- Preserve existing fonts, global styles, and unrelated configuration.
- Use `proxy.ts`, never `middleware.ts`.
- Use Croatian as `defaultLocale` with `localePrefix: "as-needed"`.
- Keep all visible application copy in translation files.
- Do not add dependencies or implement later product phases.

---

### Task 1: Shared locale and message configuration

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`
- Create: `src/i18n/navigation.ts`
- Create: `messages/hr.json`, `messages/sr.json`, `messages/en.json`, `messages/de.json`, `messages/sl.json`, `messages/pl.json`

**Interfaces:**
- Produces: `routing`, `AppLocale`, `isAppLocale`, and localized navigation helpers.

- [ ] Create the shared routing configuration and locale type guard.
- [ ] Add six schema-compatible message files with natural translations.
- [ ] Add request configuration using an explicit locale-to-import map.
- [ ] Add localized navigation helpers using `createNavigation(routing)`.
- [ ] Run TypeScript to expose integration failures expected before app setup.

### Task 2: Next.js plugin and proxy integration

**Files:**
- Modify: `next.config.ts`
- Create: `proxy.ts`

**Interfaces:**
- Consumes: `routing` from `src/i18n/routing.ts`.
- Produces: next-intl build integration and request routing.

- [ ] Wrap the preserved Next.js configuration with `createNextIntlPlugin('./src/i18n/request.ts')`.
- [ ] Export the next-intl middleware from `proxy.ts` with the official exclusion matcher.
- [ ] Run TypeScript and ESLint.

### Task 3: Locale root layout, page, metadata, and switcher

**Files:**
- Move and modify: `app/layout.tsx` to `app/[locale]/layout.tsx`
- Move and modify: `app/page.tsx` to `app/[locale]/page.tsx`
- Create: `src/components/language-switcher.tsx`
- Preserve: `app/globals.css`, `app/favicon.ico`

**Interfaces:**
- Consumes: `AppLocale`, `isAppLocale`, `routing`, messages, navigation helpers.
- Produces: statically generated localized home pages and interactive locale switching.

- [ ] Add the client-only accessible language selector using the current localized pathname.
- [ ] Make the locale layout the sole document owner, validate promised params, set request locale, and provide messages.
- [ ] Localize the starter page and metadata with next-intl server utilities.
- [ ] Confirm the old root layout and page no longer conflict.
- [ ] Run ESLint and TypeScript.

### Task 4: Production and route verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: the complete application.
- Produces: exact verification evidence.

- [ ] Run `npm run lint` and require exit code 0.
- [ ] Run `npx tsc --noEmit` because no `typecheck` script exists, and require exit code 0.
- [ ] Run `npm run build` and require exit code 0 with localized routes prerendered.
- [ ] Start the production server and verify `/`, `/en`, `/de`, `/sr`, `/sl`, `/pl`, `/fr`, and `/hr`.
- [ ] Verify `/api` and static files are not localized by the proxy matcher.
- [ ] Inspect HTML for translated content, correct `lang`, and one `<html>` and `<body>`.
