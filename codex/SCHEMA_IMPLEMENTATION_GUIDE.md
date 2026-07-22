# Passvero Schema Implementation Guide

## Current state

The structural Prisma implementation is complete. The database contains 21
models implemented through 16 applied migrations. This guide records the
implementation contract for review, maintenance, and future separately
approved changes; it is not a request to regenerate the schema.

## Authority

Use this precedence whenever sources differ:

1. `prisma/schema.prisma`
2. applied migrations
3. `codex/DECISIONS.md`
4. `codex/ARCHITECTURE_DECISIONS_FROM_AUDIT.md`
5. remaining documentation

Do not redesign a frozen domain while implementing application services.

## Implemented order

The completed structural sequence is:

1. User, Organization, Membership, Invitation
2. Product, ProductVersion, Passport
3. ProductTranslation
4. ProductIdentifier
5. ProductMaterial
6. Document
7. ProductDocument
8. ProductImage
9. QRCode
10. ScanEvent
11. AuditLog
12. Plan
13. Subscription
14. Notification
15. IntegrationMapping
16. BackgroundJob

The implementation totals 21 models because several migrations contain more
than one model.

## Core conventions

- Every model primary key is `String @id @default(uuid()) @db.Uuid`.
- Models are singular PascalCase; fields are camelCase.
- Enums are PascalCase and their values are UPPER_SNAKE_CASE.
- Business identifiers remain Strings so leading zeros are preserved.
- Exact percentages and prices use Decimal, never Float.
- Every relation has an explicit name and explicit `onDelete`/`onUpdate` on the
  foreign-key side.
- Organization ownership is direct only where the implemented schema stores
  `organizationId`; otherwise it follows the documented parent chain.
- Prisma models are persistence records and must be mapped to explicit DTOs.

## Aggregate and relation implementation

ProductVersion is the aggregate root for ProductTranslation,
ProductIdentifier, ProductMaterial, ProductDocument, and ProductImage. Their
foreign keys cascade with ProductVersion.

Document is independent and reusable. ProductDocument deletion never deletes
Document. Passport belongs to Product. QRCode belongs to Passport. ScanEvent
belongs to QRCode.

Notification has only Organization and optional User relations.
IntegrationMapping has only Organization. BackgroundJob has only optional
Organization, populated for ORGANIZATION scope.

## Manual PostgreSQL objects

Prisma does not express the implemented partial indexes or CHECK constraints.
They live in applied migration SQL and must remain covered by migration tests.

Partial unique indexes implement:

- pending Invitation uniqueness;
- one active ProductVersion draft-like row;
- IntegrationMapping uniqueness when `externalAccountId` is null;
- active BackgroundJob deduplication for PLATFORM and ORGANIZATION scope.

Manual CHECK constraints cover material percentages, Document and media
formats/lifecycles, ProductDocument ordering, QRCode lifecycle, ScanEvent
privacy-safe formats, AuditLog formats, Plan and Subscription consistency,
Notification formats/lifecycle, IntegrationMapping formats/lifecycle, and
BackgroundJob ownership/execution consistency.

Never edit an applied migration. A future physical change requires one new,
focused, reviewed migration.

## Approved Service Invariants

The following are mandatory service responsibilities, not missing database
features:

- ProductVersion and Passport tenant equality with Product;
- Product current-pointer ownership and lifecycle validity;
- ProductDocument cross-tenant rejection and public-delivery authorization;
- lifecycle transitions and chronology beyond existing CHECK constraints;
- ProductImage primary and ProductDocument multiplicity rules;
- Notification target membership/history and navigation safety;
- BackgroundJob normalization, lock-owner validity, and chronology;
- published ProductVersion aggregate immutability;
- AuditLog and ScanEvent append-only behavior;
- field-specific normalization for email, identifiers, locales, and countries.

Services enforce these inside transactions and tests. Thin repositories,
imports, administration tools, jobs, and maintenance scripts may not bypass
them. Runtime database roles should be least-privilege where practical.

## JSON contract

JSON exists only for AuditLog metadata, Plan features, Notification metadata,
IntegrationMapping metadata, and BackgroundJob payload/result. Values are
small and allowlisted. Product content remains relational. No JSON field stores
credentials, tokens, headers, cookies, complete payloads, files, binary data,
or stack traces.

## Deletion contract

Restrict protects independent and retained roots. SetNull preserves optional
actor and provenance history. Cascade applies only to true aggregate children.
Application authorization still decides whether a parent may be deleted.

Published history is not ordinarily hard-deleted. Future destructive workflows
must include authorization, impact preview, audit, retention review, and
recovery planning.

## Validation workflow for future schema work

For a separately approved schema phase:

1. read all authoritative documentation;
2. verify the schema and migration state;
3. update only the approved schema scope;
4. generate one pending migration without deploying it;
5. review and complete manual SQL where required;
6. add focused schema and migration tests;
7. run Prisma format, validate, and generate;
8. run focused and complete tests, typecheck, lint, build, and diff checks;
9. deploy only in a separate explicitly approved task;
10. verify final migration status and source-tree integrity.

Never use `db push`, `db pull`, reset, resolve, seed, RLS, or Prisma Compute as
a workaround for migration problems.

## Current governance gate

Structural Integrity Review and Architecture Decision Review are complete.
Documentation synchronization is complete. Database Production Audit is next.
Database Architecture Freeze v1.0 remains pending explicit approval.
