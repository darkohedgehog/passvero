# Application Architecture

## Architectural style

Use a modular Next.js application with clear boundaries between:

- routes and layouts;
- UI components;
- domain services;
- repositories;
- validation schemas;
- infrastructure integrations;
- shared types and utilities.

## Recommended folder structure

```txt
src/
├── app/
│   ├── [locale]/
│   │   ├── (marketing)/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   ├── p/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
│
├── components/
│   ├── marketing/
│   ├── navigation/
│   ├── dashboard/
│   ├── products/
│   ├── passports/
│   ├── forms/
│   └── ui/
│
├── i18n/
│   ├── routing.ts
│   ├── request.ts
│   └── navigation.ts
│
├── server/
│   ├── services/
│   ├── repositories/
│   ├── auth/
│   └── permissions/
│
├── lib/
│   ├── prisma.ts
│   ├── env.ts
│   ├── slug.ts
│   ├── qr.ts
│   └── constants.ts
│
├── validations/
├── types/
└── styles/
```

Adapt the structure to the actual repository. Do not create duplicate systems.

## Layer responsibilities

### `app`

Contains:

- route definitions;
- layouts;
- route handlers;
- page composition;
- metadata;
- route-level loading and error states.

Do not place complex business logic directly inside pages or route handlers.

### `components`

Contains reusable UI.

Rules:

- components should receive prepared data;
- components must not directly query Prisma;
- components should not contain organization authorization logic;
- use Server Components unless browser interactivity is required.

### `server/services`

Contains business use cases.

Examples:

- create product;
- publish passport;
- create product version;
- archive product;
- generate public passport;
- record scan event.

Services enforce business rules.

### `server/repositories`

Contains database access.

Repositories:

- accept explicit identifiers;
- return typed domain data;
- contain Prisma queries;
- do not contain presentation logic.

### `validations`

Contains Zod schemas for:

- forms;
- route payloads;
- query parameters;
- domain input.

### `lib`

Contains infrastructure helpers and shared utilities.

Avoid turning `lib` into a dumping ground.

## Server-only boundaries

Files that access:

- Prisma;
- database credentials;
- private storage keys;
- billing secrets;
- authentication secrets;

must be server-only.

Use `server-only` where useful.

## Route groups

Recommended localized route design:

```txt
src/app/[locale]/(marketing)
src/app/[locale]/(auth)
src/app/[locale]/dashboard
src/app/[locale]/p/[passportCode]
```

API routes normally remain outside the locale segment:

```txt
src/app/api
```

## Public passport URL

Use a stable public identifier:

```txt
/p/[passportCode]
```

The public URL must not expose internal sequential IDs.

## Product versions

Product passport data should be versioned.

Do not overwrite historical published passport data without preserving a version record.

Recommended concept:

- `Product` — stable product identity;
- `ProductVersion` — versioned passport content;
- one current version;
- publication timestamp;
- optional previous published versions.

## Organization isolation

Every private entity must belong to an organization.

All private reads and writes must include organization ownership checks.

Never query a private product only by `productId` when handling a user request. Query using both:

- product identifier;
- authenticated organization identifier.

## Error handling

- use typed domain errors where useful;
- do not leak database or provider errors to users;
- log internal details server-side;
- return safe user-facing messages;
- distinguish validation, authorization, not-found and infrastructure errors.
