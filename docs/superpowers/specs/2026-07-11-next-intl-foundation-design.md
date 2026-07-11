# next-intl Foundation Design

## Scope

Add a production-ready internationalization foundation to Passvero using the installed Next.js 16.2.10 and next-intl 4.13.2 versions. Support Croatian, Serbian (Latin), English, German, Slovenian, and Polish. Croatian is the unprefixed default locale.

## Architecture

The locale segment becomes the application root layout at `app/[locale]/layout.tsx`, which owns the only `<html>` and `<body>` elements and sets `lang` from a validated locale. The existing page moves to `app/[locale]/page.tsx`. Shared routing, request loading, and navigation configuration live in `src/i18n/`; the Next.js 16 entry point is `proxy.ts` at the project root because the project uses a root-level `app/` directory.

`routing.ts` is the single source of truth for supported locales and exports an `AppLocale` type plus a type guard. `request.ts` validates the requested locale and selects messages from an explicit import map, using Croatian only when no locale is supplied. Unsupported locale segments call `notFound()` and cannot select arbitrary files.

## Rendering and navigation

All locale routes are generated with `generateStaticParams`, and layouts/pages call `setRequestLocale` before next-intl server utilities. The server-rendered layout provides validated messages through `NextIntlClientProvider`. Only the language switcher is a Client Component; it uses next-intl navigation helpers to replace the current pathname with a selected locale without manually rewriting URLs.

## Routing behavior

`localePrefix: "as-needed"` produces `/` for Croatian and `/en`, `/de`, `/sr`, `/sl`, and `/pl` for other locales. The next-intl proxy canonicalizes an explicit `/hr` prefix to its unprefixed equivalent. Its matcher excludes `/api`, `/_next`, `/_vercel`, and any pathname containing a file extension.

## Content and metadata

Six message files share identical `Metadata`, `Navigation`, `Common`, and `Home` keys. All visible component text comes from these files. `generateMetadata` uses next-intl server translations after locale validation, with no canonical URL because no reliable base URL is configured.

## Verification

Run ESLint, strict TypeScript checking, and the production build. Start the production server and request the six supported routes, `/fr`, `/hr`, an API path, and a static asset. Inspect returned HTML for locale content, language attributes, and a single `<html>` and `<body>` owner.
