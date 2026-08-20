# Phase 12: Authentication, Organization Context, and Dashboard Architecture

**Status:** Proposed authoritative design, awaiting operator approval
**Date:** 2026-08-19
**Repository base:** `4f1dd4e3bf0867b90cc9ad507dd5c7e5ef704ec6`
**Scope:** Architecture and durable visual reference only; no application, schema, migration, dependency, environment, or production change

## 1. Current-state audit

Passvero currently runs Next.js 16.2.11, React 19.2.4, next-intl 4.13.2, Tailwind CSS 4.3.2, Prisma 7.8.0, and PostgreSQL. The application has localized public marketing and legal routes. `proxy.ts` performs locale routing only. There are no authentication dependencies, authentication routes, dashboard routes, admin routes, session cookies, or authentication database tables.

The existing domain already owns the business identity and authorization model:

- `User` is the canonical business identity.
- `Organization` and `Membership` define tenancy.
- `MembershipRole`, `MembershipStatus`, the permission matrix, and application services define authorization.
- Existing transactional application services revalidate organization context and permissions inside their database transaction.
- `Plan` defines entitlement configuration and `Subscription` is the current organization entitlement projection.
- `BillingProvider.MANUAL` already exists, with constraints appropriate to a provider-neutral current projection.

This Phase 12 design adds boundaries around those facts. It does not replace them.

## 2. Goals

1. Establish a secure, provider-neutral authentication foundation for verified email and password sign-in.
2. Resolve authenticated subjects to canonical Passvero users before deriving organization context or permissions.
3. Define deterministic, fail-closed dashboard routing and organization selection.
4. Define the MVP dashboard information architecture and Passvero-owned UI system.
5. Preserve future migration options for authentication, MFA, passkeys, OAuth, billing, and accounting.
6. Produce one durable visual reference governed by this specification.

## 3. Non-goals

Phase 12 does not implement authentication, dashboard routes, UI components, schema changes, migrations, dependencies, email delivery, Cloudflare configuration, Stripe, Synesis integration, public registration, tenant creation, invitations, OAuth, magic links, MFA, passkeys, or platform-admin tooling. It does not change the existing authorization model or ship an implementation plan.

## 4. Authentication foundation decision

### 4.1 Better Auth versus Auth.js

The comparison was made against current official documentation on 2026-08-20.

| Concern | Better Auth | Auth.js | Passvero assessment |
|---|---|---|---|
| Next.js 16 / proxy | Explicit Next.js 16 compatibility and `proxy.ts` guidance; full server validation is available in the Node.js proxy runtime | Strong Next.js integration, but its current documentation directs new projects toward Better Auth | Better Auth has the clearer current Next.js 16 direction |
| React 19 | React client integration and server-first APIs are compatible with the repository's React 19 architecture | React bindings remain mature | Neither requires business authorization in React; both are viable |
| Prisma / PostgreSQL | Official Prisma adapter; Prisma schema generation is supported, adapter-driven migration is not | Official Prisma adapter and established models | Better Auth is viable only with manually reviewed Passvero Prisma migrations |
| Email/password | First-class email/password, verification, password reset, and password-change APIs | Credentials provider intentionally leaves credential persistence, hashing, reset, and related flows to the application | Better Auth materially reduces custom security surface |
| Sessions | First-class database sessions, server access, revocation, expiration, rotation options, and optional cookie cache | JWT or database sessions with server access | Better Auth better matches the chosen opaque database session strategy |
| Verification/reset | Built-in lifecycle hooks and token flows, with application-owned email delivery | Application must design most credentials recovery behavior | Better Auth has the stronger foundation |
| Rate limiting | Built-in rate-limit facilities exist, but Passvero's progressive PostgreSQL policy is more specific | Primarily application/infrastructure responsibility | Both require a Passvero-owned abuse boundary |
| Bot protection | Official CAPTCHA plugin includes Cloudflare Turnstile | Application integration | Better Auth offers a useful adapter, but server-side policy remains Passvero-owned |
| MFA / passkeys | Official 2FA and passkey plugins | WebAuthn is documented as experimental | Better Auth has the clearer later roadmap; neither is enabled initially |
| Account linking | Account model and linking controls exist | Mature provider account model | Both must be wrapped by Passvero's explicit identity-linking policy |
| CSRF/session security | Origin validation, secure cookie support, session controls, and security guidance | Mature CSRF/cookie protections and documented security posture | Both are acceptable when deployed under this specification |
| Maintenance direction | Current active product direction | Maintained for security patches and critical issues, while its own official migration guide recommends Better Auth for new projects | Better Auth has the stronger long-term direction |
| Operational complexity | More built-in credential lifecycle, but more owned auth tables and careful configuration | Smaller core for credentials, but substantially more Passvero code | Better Auth reduces bespoke credential security work |
| Exit cost | Provider-specific auth tables remain isolated behind `AuthIdentity` | Same achievable boundary | Equivalent if the provider-neutral binding is enforced |

**Decision:** Better Auth is the authentication foundation. This is based on first-class credentials, recovery, database sessions, Next.js 16 guidance, security extensions, and the upstream maintenance direction—not operator preference.

The Better Auth Organization plugin is excluded. Supabase Auth is excluded. Application and domain services must not import Better Auth or depend on Better Auth user, account, session, organization, role, or permission types.

Authoritative references:

- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth email and password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth rate limits](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth CAPTCHA](https://better-auth.com/docs/plugins/captcha)
- [Better Auth 2FA](https://better-auth.com/docs/plugins/2fa)
- [Better Auth passkeys](https://better-auth.com/docs/plugins/passkey)
- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Auth.js migration direction](https://authjs.dev/getting-started/migrate-to-better-auth)
- [Auth.js credentials](https://authjs.dev/getting-started/authentication/credentials)
- [Auth.js WebAuthn](https://authjs.dev/getting-started/authentication/webauthn)
- [Auth.js Prisma adapter](https://authjs.dev/getting-started/adapters/prisma)

## 5. Provider-neutral identity mapping

Better Auth's native user table is separate from Passvero `User`. A future reviewed migration must add a dedicated provider-neutral `AuthIdentity` concept with, at minimum:

- a stable internal identifier;
- `provider`;
- opaque `providerSubject` containing the stable Better Auth user identifier;
- a required foreign key to canonical `User.id`;
- a unique constraint on `(provider, providerSubject)`;
- timestamps needed for lifecycle and auditability.

The architecture supports multiple identities per canonical user. Email is never the runtime identity key or permanent binding. It may participate in a controlled initial activation only after verified ownership.

Automatic same-email linking is disabled. Linking must be explicit, controlled, transactional, and fail closed on conflicts. An authenticated but unbound identity receives no tenant access. Every authenticated request must resolve server-side in this order:

`opaque session token → Better Auth session/user → AuthIdentity(provider, subject) → Passvero User.id → Membership/Organization → permissions`

No downstream service receives a Better Auth user as its business actor.

## 6. Session architecture

Sessions are database-backed and opaque. The Better Auth database record is authoritative; Redis and session cookie caching are disabled initially. The browser cookie contains only the opaque session credential and no organization, role, permission, entitlement, or other authorization state.

Cookie requirements are `Secure`, `HttpOnly`, `SameSite=Lax`, host-only, and restricted to the narrowest practical path compatible with the auth route. Production authentication is HTTPS-only.

Normative lifetime rules:

- inactivity timeout: 7 days;
- refresh interval: 24 hours;
- absolute timeout: 30 days from server-owned `authenticatedAt`;
- rolling expiration: enabled within the absolute limit;
- token rotation: enabled;
- rotation preserves `authenticatedAt`;
- the absolute limit requires full reauthentication;
- client activity cannot bypass expiration;
- revoke-all-sessions is required;
- password reset revokes every session;
- authenticated password change revokes other sessions and rotates the current session.

A future reviewed Prisma migration must persist any `authenticatedAt` extension not provided by the generated Better Auth schema. Expired or revoked sessions cannot retain organization context.

## 7. Organization context

Organization context is a server-side session selection. It is not authorization evidence.

Eligible membership requires both `MembershipStatus.ACTIVE` and an active organization. One eligible membership is auto-selected. Multiple eligible memberships require `/dashboard/select-organization`. No eligible membership, an unbound identity, an inactive membership, or a suspended/deactivated organization produces the safe no-access state at `/dashboard/access`.

Organization switching is a server mutation with CSRF protection. It must revalidate membership and organization status before storing selection. Client-supplied organization identifiers are untrusted. A stale or unauthorized selection is cleared and context is reevaluated. Tenant-scoped caches must be partitioned by the newly validated context or invalidated on switch.

Every business mutation preserves existing transactional authorization revalidation. Session selection never substitutes for that check.

## 8. Authorization boundary

Passvero remains authoritative for `User`, `Membership`, `Organization`, `MembershipRole`, `MembershipStatus`, permissions, tenant isolation, entitlements, billing authorization, and all business decisions. Provider-native organizations or roles cannot grant access.

Platform administration is a separate boundary from membership roles. An organization `OWNER` is not a platform administrator. Future manual subscription activation requires a dedicated platform permission and must go through an application service.

## 9. Login and activation threat model

Initial sign-in is verified email and password only. Public self-registration and tenant creation are disabled. Account creation uses controlled activation of a preprovisioned Passvero `User`.

An activation capability is opaque, single-use, expiring, and bound to canonical `User.id`; email alone never authorizes activation. The user must prove control of the intended email. Credential creation and `AuthIdentity` binding are one transaction and fail closed on collisions. No session or tenant access exists before successful completion. Existing internal production accounts require a separate operator-controlled activation procedure.

Primary threats and controls:

| Threat | Required control |
|---|---|
| Account enumeration | Generic status, timing review, shared abuse controls |
| Credential stuffing | Progressive database limits, compromised-password checks, risk-triggered Turnstile |
| Brute force | Account digest plus trusted-network and combined buckets; progressive backoff |
| Token theft | Opaque single-use tokens, fixed HTTPS origin, no logs, referrer protection |
| Session theft/fixation | Secure host-only cookie, rotation, database authority, revocation |
| Cross-tenant access | Canonical identity mapping and transactional tenant revalidation |
| Link confusion | No automatic same-email linking; transactional fail-closed binding |
| Open redirect | Allowlisted relative return paths only |

## 10. Login abuse protection

Abuse control is a Passvero-owned boundary shared by every authentication transport. Initial storage is PostgreSQL; Redis is not required.

The implementation must combine:

- a trusted-network bucket derived only after explicit trusted-proxy configuration;
- IPv4 and IPv6-aware network normalization;
- a keyed digest of the normalized account identifier, never plaintext email as a rate-limit key;
- a combined account-and-network bucket;
- global endpoint-volume protection;
- progressive backoff without permanent lockout.

Success must not erase all global evidence of an active attack. Retention, pruning, atomic counters, concurrency behavior, and operational visibility require implementation review. Generic responses are required across sign-in, activation, verification, and reset.

## 11. Bot protection

Cloudflare Turnstile is the approved provider. It is risk-triggered, not displayed on every login. Trigger signals may include progressive-rate-limit state and anomalous volume, but must not disclose whether an account exists.

Turnstile tokens are validated server-side with Cloudflare before the protected attempt proceeds. Client success is never sufficient. Failure must be generic and remain inside the shared abuse boundary. Provider outage behavior must be explicitly fail-closed for challenged attempts and operationally observable.

Reference: [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## 12. Password, verification, and recovery

Password policy follows NIST-aligned single-factor guidance:

- minimum 15 and maximum 128 Unicode code points;
- Unicode allowed and normalized to NFC before hashing and comparison;
- spaces preserved; no trimming or silent truncation;
- no composition rules or periodic expiration;
- paste, autofill, and password managers supported;
- compromised, common, and contextual passwords blocked;
- no plaintext password is transmitted to an external breach service.

Better Auth owns credential hashing using its reviewed default unless a later security review approves a change. The UI must expose correct autocomplete semantics and must not interfere with password managers.

Email verification tokens are opaque, single-use, expire after 24 hours, and a newly issued token invalidates its predecessors. Password reset tokens are opaque, single-use, expire after 30 minutes, and a newly issued token invalidates its predecessors.

Authentication links are generated only from a configured fixed HTTPS application origin; the untrusted `Host` header is forbidden. Tokens must not be logged and pages must prevent referrer leakage. Reset responses are generic. Reset revokes all sessions, does not auto-sign-in, and requires normal sign-in afterward. Password changes send a security notification. Authenticated password change requires the current password, revokes other sessions, and rotates the current session.

References: [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) and [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## 13. Deferred authentication capabilities

OAuth, magic links, general invitations, public onboarding, MFA, and passkeys are deferred. Better Auth's 2FA and passkey plugins establish a credible roadmap but are not configured, migrated, advertised, or partially exposed in the initial release. Each requires a later approved threat model, recovery design, schema review, UX review, and rollout decision.

## 14. Route protection and normative redirect semantics

`proxy.ts` remains useful for locale normalization and optional optimistic routing only. It is not a security boundary. Every protected page, route handler, server action, and application service must perform authoritative server-side validation.

The redirect state machine is normative:

| State | Required result |
|---|---|
| Unauthenticated request to protected route | Redirect to `/login` with a validated relative return path |
| Authenticated, unbound identity | Redirect to `/dashboard/access` |
| Authenticated, no eligible membership | Redirect to `/dashboard/access` |
| One eligible membership, no selection | Select server-side and continue |
| Multiple eligible memberships, no selection | Redirect to `/dashboard/select-organization` |
| Stale or unauthorized selection | Clear it and reevaluate from the beginning |
| Suspended/deactivated organization | Redirect to `/dashboard/access` |
| Inactive membership | Redirect to `/dashboard/access` |
| Valid context | Continue to requested protected route |

Return paths must be allowlisted relative application paths. Absolute URLs, scheme-relative URLs, encoded external origins, backslash variants, control characters, and ambiguous normalization are rejected. Locale prefixes must be validated against the configured next-intl locales; a return path cannot escape or confuse locale behavior. Redirect destinations are deterministic, fail closed, and protected against loops. Cross-tenant resource access returns safe not-found behavior rather than disclosing existence.

## 15. Dashboard information architecture

Live public authentication routes:

- `/login`
- `/activate-account`
- `/forgot-password`
- `/reset-password`
- `/verify-email`

Live authenticated pre-context routes:

- `/dashboard/select-organization`
- `/dashboard/access`

MVP organization-context routes:

- `/dashboard`
- `/dashboard/products`
- `/dashboard/products/new`
- `/dashboard/products/[id]`
- `/dashboard/settings/profile`
- `/dashboard/settings/organization`

MVP navigation contains only Overview, Products, and Settings. Unimplemented items are neither visible nor disabled.

Reserved specification-only namespaces include future members, billing, passports, documents, integrations, and `/admin` including `/admin/billing`. Reservation grants no implementation authority. Billing navigation remains absent until its implementation is approved and complete.

## 16. UI component architecture

The authenticated application uses Passvero-owned, shadcn-style source components with Tailwind 4 and semantic design tokens. It does not install the full shadcn catalog or adopt a generic shadcn theme.

- Simple controls use native HTML where practical.
- Complex interactions may use selectively reviewed Radix primitives.
- Locally owned primitives live in `src/components/ui`.
- Application composites live in `src/components/application`.
- Composites do not import Radix directly; they depend on Passvero UI abstractions.
- Server Components are the default; client boundaries contain only the smallest interactive scope.
- Dependencies are added per approved workflow. Existing transitive Radix packages do not become application dependencies by accident.
- Upstream component updates require code review.

## 17. Visual tokens and direction

Refined Quiet Studio is canonical: one cohesive light theme, no dark mode and no dual-theme infrastructure. The dashboard continues the marketing identity while becoming denser and more operational.

The token families are warm canvas, white work surface, navy structure, Passvero teal accent, restrained borders, and semantic success/warning/danger/info states. Tokens, not page-specific colors, define states. Teal is strategic rather than omnipresent. Radius is restrained, shadows minimal, and cards exist only where they clarify hierarchy.

Status is never color-only: visible text and a supporting shape/indicator are required. Focus indicators must be clearly visible and meet contrast requirements.

## 18. Dashboard shell

Desktop uses a navy orientation sidebar, organization switcher, the three live navigation groups, page header, and account control. The active route receives a persistent teal indicator plus text/state treatment. Page headings establish breadcrumb/context, title, supporting text, then actions.

Mobile uses a compact top bar and modal navigation drawer with focus containment, Escape support, restoration of focus, and background inertness. There is no persistent bottom navigation. Organization switching remains a server-validated control inside the drawer.

## 19. Login UI

The login page is focused and quiet, with Passvero identity, email, password, recovery link, primary sign-in action, validation summary, field errors, pending state, and generic failure state. Marketing content does not compete with the task. Verification-required and expired-link states provide safe resend actions without account disclosure.

## 20. Dashboard home and products list

The dashboard home emphasizes product work rather than decorative analytics. Purposeful summaries may link directly to real workflows. Decorative charts are excluded.

The products view is a compact semantic table on desktop with product, SKU, lifecycle, locale/version, modified time, and row actions. Search and filters preserve URL/server state where appropriate. Loading, empty, no-result, error, and unauthorized states are explicit.

On narrow screens, the table becomes semantic product cards. Lower-priority metadata collapses, but product identity and lifecycle status remain visible. Horizontal scrolling is a last resort, not the default mobile behavior.

## 21. Create Product

The initial form reflects the already approved canonical CreateProduct command: product name, optional SKU, and source locale. It does not invent passport fields. Labels, descriptions, errors, required state, pending state, and server error summary are accessible. Cancel is secondary and explicit; successful creation enters the product workspace.

The server remains authoritative for normalization, uniqueness, organization context, permission, and transaction behavior.

## 22. Product workspace shell

The MVP route provides an Overview workspace anchored to the canonical product. Future translations, documents, and passport areas are not shown as live or disabled navigation until implemented. The shell may summarize actual next steps and recent activity only when backed by implemented data.

## 23. Settings

MVP settings exposes Profile and Organization only. Settings follow the same header and form hierarchy as product workflows. Permission-gated controls are enforced server-side and represented honestly in the UI. Members and billing are reserved future surfaces and are absent from live navigation.

## 24. Billing architecture and schema assessment

The approved future architecture is a Passvero entitlement projection with provider-hosted commerce and manual annual billing.

Existing `Plan` and `Subscription` support a current manual annual entitlement projection without Phase 12 schema changes:

- `BillingProvider.MANUAL` exists.
- `Plan` holds yearly price, currency, limits, and features.
- `Subscription` holds organization, plan, provider, status, period bounds, and current-period-end indexing.
- Existing constraints require provider IDs/configuration to remain null for manual subscriptions.

The existing schema does **not** support the complete manual commercial workflow or immutable commercial history. A later separately reviewed migration will need provider-neutral persistence for:

- customer renewal/quote requests and their lifecycle;
- an immutable commercial record;
- unique external document reference;
- amount and currency snapshots;
- plan and entitlement snapshots;
- entitlement period;
- confirmation actor and timestamp;
- lifecycle status and idempotency key/correlation;
- transactional audit correlation.

The exact future model is deliberately not selected in Phase 12. Its acceptance gate is the immutable/minimal record contract above, uniqueness and idempotency constraints, retention rules, and a reviewed Prisma migration.

## 25. Manual accounting and Stripe boundaries

Synesis by Pupilla is an external, manually operated legal document authority only. No direct Synesis integration or WooCommerce bridge is planned. Passvero does not generate legal quotes, invoices, or accounting documents; does not become an accounting ledger; and does not store bank credentials, sensitive banking data, or full Synesis payloads. The domain model must not contain Synesis-specific schema.

An organization owner may request a manual annual renewal quote but cannot activate a subscription. A platform administrator with a future dedicated permission manually enters the provider-neutral external reference and confirms payment through an application service. Duplicate references and duplicate confirmations fail closed. Confirmation is idempotent. The immutable commercial record, mutable `Subscription` projection, and `AuditLog` update occur transactionally.

Stripe remains a supported future path. Stripe is authoritative for payment execution. Checkout and customer management use provider-hosted surfaces. Webhooks require raw-body signature verification, durable idempotent event handling, replay safety, and reconciliation. Passvero `Subscription` remains the current entitlement projection, not the payment ledger.

Customer billing is reserved at `/dashboard/settings/billing`; platform operations are reserved at `/admin/billing`. When implemented, the customer view shows provider, period end, and server-derived days remaining—not a live authorization countdown. Manual customers request a renewal quote; Stripe customers use the hosted portal. Platform operations require provider and 30-day, 7-day, and expired filters.

References: [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal), and [Stripe webhooks](https://docs.stripe.com/webhooks).

## 26. Platform administration

`/admin` is a separate future authorization and route boundary. No membership role implies platform access. Future manual billing confirmation requires a dedicated platform permission; current platform permissions are insufficient for tenant subscription mutation. Direct admin-UI Prisma mutation is forbidden. Every operation uses an application service and transactional audit logging.

## 27. Accessibility

Target WCAG 2.2 AA. Requirements include semantic landmarks and headings, visible labels, error association and summaries, logical focus order, keyboard-complete controls, 44-by-44 CSS-pixel mobile targets where practical, sufficient text/non-text contrast, reduced-motion respect, no color-only state, announced async results, and robust zoom/reflow at 400%. Authentication failures must remain understandable without revealing account existence.

## 28. Performance

Server Components remain the default. Authentication/session/organization resolution must avoid request waterfalls and redundant database queries without weakening authority. No session cookie cache or Redis is introduced initially. Dashboard queries are organization-scoped, bounded, paginated, and projected to required fields. Client bundles exclude server auth/provider logic and unnecessary component libraries.

## 29. Error and safe-state behavior

Errors are categorized as field validation, generic authentication failure, safe access denial, not found, conflict, rate limited/challenged, and transient service failure. Security-sensitive distinctions are logged only in protected structured telemetry with no credentials or tokens; users receive safe generic copy. No page silently falls back to another organization.

## 30. Testing strategy

Implementation requires unit, integration, route, component accessibility, and end-to-end coverage. Tests must cover identity resolution, unbound identities, session expiry/rotation/revocation, activation transactions, password lifecycle, membership changes, organization switching, cross-tenant resources, and each permission boundary.

Database tests use only the repository's fail-closed `TEST_DATABASE_URL` boundary. They never fall back to `DATABASE_URL` and never target production.

## 31. Security and implementation-review checklist

Authentication/dashboard implementation is incomplete until review evidence confirms:

- [ ] Better Auth schema and every migration were manually reconciled with Passvero Prisma models.
- [ ] Better Auth Organization plugin, public sign-up, OAuth, magic links, MFA, and passkeys remain disabled.
- [ ] Provider subject resolves to `AuthIdentity` and canonical `User.id`; email is not a runtime binding.
- [ ] Automatic same-email account linking is absent and conflicts fail closed.
- [ ] Session cookies, database authority, rotation, inactivity, absolute expiry, and revoke-all behavior match this specification.
- [ ] Password normalization, length, compromised/common/contextual blocklists, and password-manager semantics are verified.
- [ ] Verification, activation, and reset tokens are opaque, single-use, correctly expiring, superseding, and absent from logs/referrers.
- [ ] Fixed HTTPS link origin is used; untrusted host headers cannot influence links.
- [ ] Progressive PostgreSQL abuse controls cover trusted networks, normalized account digests, combined buckets, IPv6, and global volume.
- [ ] Turnstile is risk-triggered and validated server-side.
- [ ] Proxy/cookie presence is never treated as authorization.
- [ ] Server pages, route handlers, actions, and domain mutations validate session, canonical identity, organization, membership, and permission as applicable.
- [ ] Transactional authorization revalidation is preserved.
- [ ] Redirect-loop tests pass.
- [ ] Safe return-path tests cover absolute, external, encoded, malformed, and scheme-relative inputs.
- [ ] Locale-prefix and cross-locale return-path tests pass.
- [ ] Unbound, no-membership, inactive, suspended, stale-selection, and unauthorized-context tests pass.
- [ ] Cross-tenant resource access returns safe not-found behavior.
- [ ] Organization switch CSRF protection, revalidation, and cache partition/invalidation are tested.
- [ ] No unimplemented route appears as live or disabled navigation.
- [ ] Keyboard, focus, screen-reader, contrast, zoom/reflow, and responsive product-list behavior are tested.
- [ ] No auth token, password, bank credential, or sensitive provider payload is logged or persisted outside its approved boundary.

## 32. Durable visual reference and authority

The approved refined Quiet Studio artifact is:

`docs/superpowers/specs/assets/2026-08-19-passvero-auth-dashboard/quiet-studio-reference.html`

It is a static visual implementation reference, not an application route, Figma source of truth, backend, or authentication dependency. It demonstrates the login page, dashboard shell/home, products table, Create Product form, product workspace shell, settings/future billing shell, and mobile behavior.

This specification is authoritative for architecture, security, authorization, routes, responsive behavior, component semantics, and release scope. If the HTML and specification conflict, implementation must stop and obtain explicit reconciliation. It may not silently choose either interpretation. The durable artifact intentionally removes future live navigation that appeared in the exploratory board; its billing surface is explicitly marked as a future reference.

## 33. Delivery phases and gates

This section establishes sequencing constraints, not an implementation plan:

1. Approved design specification and durable reference.
2. Separately approved implementation plan.
3. Manually reviewed Better Auth, `AuthIdentity`, session-extension, and abuse-control schema proposal and migration.
4. Authentication foundation, activation, verification, recovery, and abuse controls.
5. Canonical identity and organization-context resolution with route-state tests.
6. Passvero UI primitives and MVP dashboard routes.
7. Security, accessibility, responsive, and operational review.

No phase may consume a later phase's authority. Schema review is separate from migration deployment. Billing persistence, Stripe, manual billing operations, platform admin, MFA, passkeys, OAuth, magic links, invitations, and public onboarding each require later explicit approval.

## 34. Future decision triggers

The following are not open placeholders; they are explicit later gates:

- **Auth schema gate:** approve exact Better Auth-generated tables, names, relations, indexes, constraints, `AuthIdentity`, `authenticatedAt`, and abuse-control persistence before migration creation.
- **Email gate:** select and review the transactional email provider, templates, deliverability controls, and operational handling before auth email implementation.
- **MFA/passkey gate:** approve threat model, recovery, enrollment, schema, and UX before enabling either plugin.
- **OAuth/linking gate:** approve provider list and explicit linking proof before any social provider.
- **Billing persistence gate:** approve provider-neutral renewal request, immutable commercial record, idempotency, retention, permissions, and migration.
- **Stripe gate:** approve checkout/portal/webhook/reconciliation design and provider-identity constraints.
- **Platform-admin gate:** approve independent authentication/authorization boundary, dedicated permissions, routes, audit, and operational controls.
- **Navigation gate:** only implemented, authorized routes may enter the live navigation.

Approval of this specification authorizes preparation of a separate implementation plan; it does not authorize implementation.
