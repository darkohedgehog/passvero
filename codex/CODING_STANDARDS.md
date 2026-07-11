# Coding Standards

## TypeScript

- Use strict TypeScript.
- Never use `any`.
- Avoid broad type assertions.
- Prefer inferred types from schemas and functions.
- Use `unknown` for untrusted values and validate them.
- Export domain types only when shared across module boundaries.
- Prefer discriminated unions for stateful workflows.

## Naming

Use descriptive names.

Good:

```ts
createProductPassport
organizationId
publishedVersion
validatedInput
```

Avoid:

```ts
data
item
obj
handleThing
temp
```

## React

- Prefer Server Components.
- Add `"use client"` only where required.
- Do not make a whole page client-side because one control is interactive.
- Keep hooks in client components.
- Avoid unnecessary effects.
- Do not fetch server data from `useEffect` when it can be loaded on the server.
- Use semantic HTML.
- Provide accessible labels.

## Next.js

- Follow the API supported by the installed Next.js version.
- Inspect the project version before implementing.
- Use route handlers for external HTTP APIs.
- Prefer server actions for tightly coupled authenticated form mutations when appropriate.
- Validate all inputs regardless of whether they come from forms, actions or route handlers.
- Use `generateMetadata` for localized metadata.
- Avoid duplicate `<html>` and `<body>` elements.
- Preserve static rendering where possible.

## Data access

- Prisma access belongs in server-side modules.
- Do not import Prisma into client components.
- Avoid N+1 queries.
- Select only fields needed by the caller.
- Use transactions for multi-step writes that must succeed atomically.
- Add indexes for organization ownership, public codes and frequent filters.

## Validation

All untrusted input must be validated with Zod.

Validate:

- route params;
- search params;
- JSON bodies;
- form data;
- environment variables;
- uploaded file metadata;
- provider webhooks.

## Environment variables

Use a typed environment module.

Rules:

- validate required environment variables at startup;
- never read private environment variables from client code;
- only expose values prefixed with `NEXT_PUBLIC_` when intentionally public;
- do not add secrets to `.env.example`;
- document required keys.

## Comments

Comments should explain why, not restate what code does.

Avoid large speculative comments and dead code.

## Dependencies

Before adding a package:

1. check whether the requirement can be met with existing dependencies;
2. confirm compatibility with the installed Next.js and React versions;
3. prefer maintained packages;
4. avoid large dependencies for trivial utilities.

## Formatting

Follow existing repository formatting.

Do not reformat unrelated files.

## Imports

Prefer project aliases such as:

```ts
import {routing} from '@/i18n/routing';
```

Avoid deep relative imports when aliases exist.

## Error messages

User-facing messages must be:

- safe;
- localized;
- actionable;
- free from stack traces or provider details.
