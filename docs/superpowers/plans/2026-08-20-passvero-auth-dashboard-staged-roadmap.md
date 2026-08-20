# Passvero Authentication and Dashboard Staged Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sequence the approved authentication, organization-context, and dashboard architecture into independently reviewable implementation stages without crossing unresolved security, schema, email, or billing gates.

**Architecture:** Better Auth remains isolated at the transport/infrastructure boundary and resolves through a provider-neutral `AuthIdentity` to canonical Passvero `User.id`. Each stage produces a testable deliverable and locks the interfaces consumed by the next stage; stages with unresolved approved gates receive their detailed plan only after the preceding gate is approved.

**Tech Stack:** Next.js 16.2.11, React 19.2.4, TypeScript 5.9, Prisma 7.8.0, PostgreSQL, Better Auth 1.7.1 candidate baseline, next-intl 4.13.2, Tailwind CSS 4.3.2, Node test runner, Cloudflare Turnstile later in the sequence.

**Spec:** `docs/superpowers/specs/2026-08-19-passvero-auth-dashboard-design.md`

## Global Constraints

- The approved Phase 12 specification is authoritative.
- Better Auth is authoritative only for authentication proof, credentials, recovery, and session establishment.
- Passvero remains authoritative for business identity, organizations, memberships, roles, statuses, permissions, tenant isolation, entitlements, and billing authorization.
- Better Auth's Organization plugin remains excluded.
- Supabase Auth, public registration, public tenant creation, OAuth, magic links, MFA, and passkeys remain excluded from the initial release.
- Email is never the permanent or runtime authentication-to-`User` binding.
- Provider subject resolution must reach canonical `User.id` before organization context or permissions are derived.
- Automatic same-email linking remains disabled.
- Database-backed opaque sessions are authoritative; cookie cache and Redis remain disabled.
- No organization, role, permission, or entitlement state is trusted from cookies.
- `proxy.ts` is not a security boundary.
- Transactional authorization revalidation remains mandatory for business writes.
- Schema proposal, migration creation, migration deployment, and production deployment are separate approvals.
- Implementation uses an isolated worktree from an explicitly recorded approved base.
- Tests using PostgreSQL use only `TEST_DATABASE_URL`; no fallback to `DATABASE_URL` is allowed.
- Secrets, passwords, session tokens, activation tokens, reset tokens, database URLs, and Turnstile secrets must never appear in logs, fixtures, commits, or review artifacts.
- No future stage is authorized merely because it appears in this roadmap.

---

## Stage Dependency Map

| Stage | Deliverable | Requires | Locks for later stages |
| --- | --- | --- | --- |
| 13A | Better Auth dependency and persistence review packet | Approved Phase 12 spec | Exact packages, auth table names/fields, `AuthIdentity`, session extensions, abuse/token persistence, reviewed migration contract |
| 13B | Reviewed auth persistence schema, migration source, and schema tests; no deployment | Approved 13A persistence contract | Canonical model/field names and immutable migration source |
| 13C | Controlled deployment of the single approved auth migration | Approved 13B migration source and separate deployment authority | Deployed auth persistence baseline |
| 13D | Better Auth core, provider-neutral identity adapter, and opaque sessions | Completed 13C deployment | `AuthenticatedIdentity`, `CurrentUser`, session access/revocation APIs |
| 13E | Controlled activation, verified credentials, recovery, password policy, and abuse controls | 13D plus approved email-delivery gate | Credential lifecycle services and shared abuse-control boundary |
| 13F | Organization-context resolver, session selection, protected routing, and redirect state machine | 13D identity/session interfaces | `OrganizationContext`, route guard, safe return-path APIs |
| 13G | Passvero UI primitives, login states, dashboard shell, and access/organization chooser routes | 13E and 13F | Stable UI primitives and authenticated application shell |
| 13H | Products query service and responsive products list | 13F and 13G | Organization-scoped product-list DTO/query contract |
| 13I | Create Product server transport and form | 13F, 13G, and existing CreateProduct service | Safe server-action result and product-workspace redirect contract |
| 13J | Product workspace overview, profile/organization settings, and cumulative release review | 13H and 13I | Initial authenticated MVP release candidate |
| Later | Manual billing, Stripe, team/invitations, platform admin, MFA, passkeys, OAuth | Separate approved designs and persistence/permission gates | Outside initial authenticated MVP |

## Stage 13A: Authentication foundation review

Detailed plan: `docs/superpowers/plans/2026-08-20-passvero-auth-foundation-review.md`

This is the only detailed plan authorized by the currently known interfaces. It is review-only: it may query official package metadata and generate a candidate schema in a temporary directory, but it must not modify `prisma/schema.prisma`, create a repository migration, connect to a database, or add runtime source.

Exit evidence:

- exact Better Auth and Prisma-adapter versions;
- official compatibility references captured on the execution date;
- untouched raw generated Prisma schema candidate;
- field-by-field reconciliation against the existing Passvero schema;
- exact proposed names and constraints for provider tables and Passvero-owned auth support tables;
- explicit treatment of `authenticatedAt`, server-side organization selection, activation, verification/reset token invalidation, progressive PostgreSQL abuse control, and cleanup/retention;
- migration-risk and rollback analysis;
- operator decision record approving or rejecting the schema contract.

## Stage 13B: Canonical auth schema and migration source

Generate this detailed plan only after Stage 13A approves exact persistence names and constraints. It may modify `package.json`, `package-lock.json`, `prisma/schema.prisma`, schema tests, and one new migration source. It must demonstrate RED to GREEN for every model, field, relation, index, CHECK, and partial index; preserve all earlier migration hashes; and stop before database deployment.

## Stage 13C: Controlled auth migration deployment

Generate this operational plan only after Stage 13B's migration source is committed and reviewed. It must contain pre-deployment migration status, apply only the single approved pending migration, post-deployment status, schema reconciliation, and rollback/escalation evidence. It may not modify source, schema, migration files, configuration, credentials, or production data.

## Stage 13D: Authentication core and identity mapping

Generate this detailed plan only after Stage 13C deploys and reconciles the exact approved persistence baseline. Its independently testable deliverable is server-only Better Auth configuration with public sign-up disabled, opaque database sessions, provider-neutral identity resolution, and revoke-one/revoke-all session operations.

Required interfaces to lock in that plan:

```ts
export interface AuthenticatedIdentity {
  readonly provider: "BETTER_AUTH";
  readonly providerSubject: string;
  readonly sessionId: string;
  readonly authenticatedAt: Date;
}

export interface CurrentUser {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
}

export type ResolveCurrentUser = (
  identity: AuthenticatedIdentity,
  correlationId: string,
) => Promise<CurrentUser | null>;
```

The plan must include boundary tests proving application/domain modules do not import `better-auth`, generated auth models, cookies, headers, or Next.js transport APIs.

## Stage 13E: Credential lifecycle and abuse controls

Generate this detailed plan only after the email provider, fixed HTTPS application origin, sender identity, bounce/complaint handling, and template languages are approved. Its deliverable includes controlled activation for preprovisioned users, mandatory verification, normal sign-in, reset/change flows, revoke behavior, password blocklists, generic responses, and the shared PostgreSQL abuse boundary.

The plan must preserve these exact values:

- password length 15–128;
- NFC normalization without trimming or truncation;
- verification lifetime 24 hours;
- reset lifetime 30 minutes;
- session inactivity 7 days;
- refresh interval 24 hours;
- absolute session lifetime 30 days;
- risk-triggered Turnstile with server-side validation;
- no Redis and no permanent lockout.

## Stage 13F: Organization context and protected routes

Generate this plan after Stage 13D locks identity/session interfaces. Its deliverable is a server-owned organization selection, canonical membership/organization resolution, permission derivation, and the normative redirect state machine.

Interfaces to preserve:

```ts
export interface OrganizationContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly membershipRole: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  readonly membershipStatus: "ACTIVE";
  readonly permissions: readonly string[];
  readonly correlationId: string;
}

export type OrganizationContextResult =
  | { readonly kind: "VALID"; readonly context: OrganizationContext }
  | { readonly kind: "UNBOUND_IDENTITY" }
  | { readonly kind: "NO_ELIGIBLE_MEMBERSHIP" }
  | { readonly kind: "SELECTION_REQUIRED" }
  | { readonly kind: "SELECTION_CLEARED" };
```

The detailed plan must include redirect-loop, return-path, locale-prefix, stale-selection, suspended-organization, inactive-membership, and cross-tenant not-found tests before UI work consumes the guard.

## Stage 13G: UI primitives and authenticated shell

Generate this plan after credential and organization-context routes work end-to-end. It introduces only workflow-required Passvero-owned primitives under `src/components/ui` and composites under `src/components/application`. Native HTML is preferred for simple controls; any Radix dependency is individually justified and reviewed.

Deliverables:

- semantic Quiet Studio tokens in the existing Tailwind 4 foundation;
- login, verification-required, access, and organization-selection states;
- responsive authenticated shell with Overview, Products, and Settings only;
- mobile drawer with focus containment and restoration;
- accessible controls, statuses, error summaries, pending states, and reduced motion;
- no dark-mode or dual-theme infrastructure.

## Stage 13H: Products query and list

Generate this plan after the shell and organization guard stabilize. React components must not read Prisma directly. The application query returns a narrow DTO and owns pagination/search/sort validation; the Prisma adapter enforces `organizationId` on every read.

Required initial shape:

```ts
export interface ProductListItem {
  readonly productId: string;
  readonly name: string;
  readonly sku: string | null;
  readonly lifecycleStatus: "ACTIVE" | "ARCHIVED";
  readonly currentVersionStatus:
    | "DRAFT"
    | "READY_FOR_REVIEW"
    | "PUBLISHED"
    | "SUPERSEDED"
    | "DISCARDED"
    | null;
  readonly sourceLocale: string | null;
  readonly updatedAt: Date;
}
```

The detailed plan must specify stable cursor or offset semantics from actual query requirements, not UI preference, and cover empty, no-result, error, mobile-card, and cross-tenant cases.

## Stage 13I: Create Product transport

Generate this plan after Stage 13F exposes a stable `OrganizationContext` adapter. The server action parses only product name, optional SKU, and source locale; it calls the existing canonical CreateProduct service and maps only safe `ApplicationError` information to the form.

No transport may call `prisma.product.create`. The detailed plan must test authenticated context derivation, locale handling, safe error mapping, pending/double-submit behavior, success redirect to `/dashboard/products/[productId]`, and preservation of existing transactional authorization revalidation.

## Stage 13J: MVP completion and release gate

Generate this plan after the product list and Create Product transport are green. It covers only the implemented product Overview workspace plus Profile and Organization settings. Future workspace tabs, Members, Billing, Passports, Documents, Integrations, and `/admin` remain absent from navigation.

Release evidence must include:

- full unit, schema, infrastructure, integration, and end-to-end suites;
- authentication/account-recovery threat-model review;
- tenant-isolation and transactional-authorization review;
- redirect-loop, return-path, locale-prefix, and unauthorized-context review;
- keyboard, screen-reader, focus, contrast, zoom/reflow, and responsive verification;
- session expiry/rotation/revocation operational checks;
- token/log/telemetry redaction review;
- documented rollback that does not reinterpret failed authentication as authorized access.

## Planning and execution rule

- [ ] Execute Stage 13A from its detailed plan in a fresh isolated worktree.
- [ ] Obtain explicit operator approval of the Stage 13A persistence contract.
- [ ] Write the detailed Stage 13B plan using the approved exact schema names.
- [ ] Execute and review Stage 13B, then separately authorize and execute Stage 13C deployment.
- [ ] Write Stage 13D only after the deployed persistence baseline is reconciled.
- [ ] Continue one independently testable stage at a time; never batch unresolved gates.

## Approved-spec coverage matrix

| Specification sections | Owning stage |
| --- | --- |
| 1–3 Current state, goals, non-goals | Roadmap global constraints and every stage preflight |
| 4 Authentication foundation | 13A–13E |
| 5 Provider-neutral identity | 13A, 13B, 13D |
| 6 Sessions | 13A, 13B, 13D |
| 7 Organization context | 13F |
| 8 Authorization boundary | 13D, 13F, 13I |
| 9 Login/activation threat model | 13E and 13J security gate |
| 10 Login abuse protection | 13A, 13B, 13E |
| 11 Bot protection | 13E |
| 12 Password, verification, recovery | 13A, 13B, 13E |
| 13 Deferred auth capabilities | Every stage exclusion check |
| 14 Protected routes and redirects | 13F and 13J release gate |
| 15 Dashboard information architecture | 13G–13J |
| 16–19 UI architecture, tokens, shell, login | 13G |
| 20 Products list | 13H |
| 21 Create Product | 13I |
| 22–23 Product workspace and settings | 13J |
| 24–26 Billing, Stripe/manual accounting, platform admin | Separate future plans after dedicated gates |
| 27 Accessibility | 13G and 13J |
| 28 Performance | 13G–13J |
| 29 Error model | 13D–13J |
| 30–31 Testing and security review | Every detailed plan plus 13J cumulative gate |
| 32 Durable visual reference | 13G implementation input and 13J visual reconciliation |
| 33 Delivery phases | This roadmap |
| 34 Future triggers | Stage prerequisites and separate future plans |

This roadmap is not authority to implement any stage.
