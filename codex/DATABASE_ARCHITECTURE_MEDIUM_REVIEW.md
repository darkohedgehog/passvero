# Passvero Database Architecture MEDIUM Findings Review

Review date: 2026-07-22

# Executive Summary

All six MEDIUM findings describe observable properties of the applied schema,
but they do not all establish architecture defects.

M-01, M-03, M-04, and M-06 each contain at least one stable, row-local or
identity invariant that PostgreSQL can enforce without taking over workflow or
authorization. Those findings are accepted. Their database work must be
designed and reviewed separately; this review does not implement it.

M-02 combines one real presentation invariant with multiplicity assumptions
that are not fully established. The architecture explicitly assigns primary
selection to application services, while duplicate ProductDocument rows can
represent different category or locale contexts. It is accepted as a service
invariant, not as a required uniqueness migration.

M-05 is technically correct that archived rows remain inside the mapping's
unique identity, but it assumes that reconnecting must create a replacement
row. The approved model instead treats IntegrationMapping as the retained
lifecycle record for a stable mapping identity. The finding is rejected unless
a future requirement introduces immutable mapping episodes.

Peer-review outcome:

- M-01: **Accepted**, reviewed severity MEDIUM
- M-02: **Accepted as Service Invariant**, reviewed severity LOW
- M-03: **Accepted**, reviewed severity MEDIUM
- M-04: **Accepted**, reviewed severity MEDIUM
- M-05: **Rejected**, reviewed severity LOW
- M-06: **Accepted**, reviewed severity MEDIUM

# M-01 — Core lifecycle rows

## Restatement

Several core models allow status and timestamp combinations that contradict
their documented lifecycle meaning. The database either has no corresponding
CHECK constraint or enforces only one direction of the relationship.

## Technical correctness

The finding is technically correct.

The database permits, among other states:

- an ACCEPTED Invitation with no `acceptedAt`;
- an ACTIVE Product with `archivedAt` populated;
- a PUBLISHED ProductVersion without `publishedAt` or `versionNumber`;
- a WITHDRAWN Passport without `withdrawnAt`;
- Document timestamps that do not match its current status.

The Document migration requires selected timestamps for AVAILABLE, FAILED, and
ARCHIVED states, but it does not reject timestamps that are incompatible with
other states. The other listed models lack equivalent lifecycle CHECKs.

The audit is too broad only if it implies that every historical timestamp must
be null outside its originating state. For example, a SUPERSEDED version should
retain publication history, and later states may legitimately retain earlier
milestone timestamps. The required truth tables must therefore be defined per
model before migration design.

## Arguments supporting the audit

- Status and its required milestone timestamps are columns on the same row and
  are naturally enforceable by PostgreSQL CHECK constraints.
- The architecture already uses such checks for Document, QRCode,
  Subscription, Notification, IntegrationMapping, and BackgroundJob.
- Publication and withdrawal history becomes ambiguous when a terminal status
  lacks its defining timestamp.
- Database protection covers imports, maintenance scripts, and future writers
  that may bypass an application service.
- Narrow ordering checks can prevent timestamps from preceding creation or an
  earlier lifecycle milestone without implementing transitions in the
  database.

## Arguments against the audit

- Authorization, permitted transitions, and multi-row publication workflow
  remain application-service responsibilities.
- Some timestamps are durable history and should survive later status changes;
  a simplistic mutually exclusive CHECK would reject valid rows.
- Organization archival semantics are less precisely documented than
  ProductVersion publication or Passport withdrawal semantics.
- Adding constraints without first defining legacy-state and restoration rules
  could freeze accidental assumptions into the database.
- Application transactions must set status and timestamps together regardless
  of database checks.

## Database vs Service responsibility

**Shared responsibility.**

The database should enforce stable same-row consistency and timestamp ordering.
Authenticated transactional services should continue to own authorization,
transition eligibility, actor attribution, and multi-row effects.

## Production risk

**MEDIUM**

Contradictory lifecycle data can corrupt publication history and operational
recovery, although exploitation generally requires a defective or unguarded
writer rather than an ordinary read path.

## Architecture trade-off evaluation

The architecture intentionally keeps workflow transitions in services, but it
does not consistently assign basic same-row lifecycle consistency to services.
Later migrations demonstrate a project preference for database CHECKs when the
truth table is stable. The current omission is therefore not a necessary or
fully intentional consequence of the service boundary.

## Recommendation

**Accepted**

Before Architecture Freeze, define reviewed per-model lifecycle truth tables
and add only the stable CHECK and timestamp-ordering constraints. Preserve valid
historical milestone timestamps. Do not introduce triggers or move transition
authorization into PostgreSQL.

# M-02 — Primary media and association multiplicity

## Restatement

ProductImage does not database-enforce at most one primary image per
ProductVersion. ProductDocument permits repeated ProductVersion/Document pairs
and multiple primary associations, potentially creating ambiguous public
selection.

## Technical correctness

The finding is partially correct.

The ProductImage index on `(productVersionId, isPrimary)` is non-unique, so the
database permits multiple primary images for one ProductVersion. The domain
rule states that a ProductVersion may have at most one primary image.

ProductDocument likewise has no uniqueness constraint for
`(productVersionId, documentId)` and no partial primary uniqueness. However,
the current architecture stores category, locale, visibility, and presentation
context on the association and explicitly allows one physical Document to be
reused in different business contexts. It does not freeze one universal
ProductDocument primary scope. Duplicate parent IDs are therefore not, by
themselves, proof of an invalid association.

## Arguments supporting the audit

- Multiple primary images can make deterministic public serialization depend
  on incidental ordering.
- A partial unique ProductImage index could enforce the clear one-primary rule.
- Duplicate ProductDocument rows with identical business context can create
  repeated public output.
- Every future writer must otherwise reproduce the same selection logic.
- Published content should be deterministic and historically stable.

## Arguments against the audit

- `DATABASE_ARCHITECTURE.md` explicitly assigns ProductImage and
  ProductDocument primary selection to application services.
- The ProductImage model guidance expressly permits service enforcement for
  MVP when tested.
- ProductDocument `isPrimary` can require a category, locale, or visibility
  scope; no single database key is yet an approved invariant.
- Repeating the same Document can be legitimate when its category, locale, or
  display treatment differs.
- A premature uniqueness constraint could prohibit valid content modeling and
  make transactional reordering harder.
- Publication completeness and deterministic serializer ordering are already
  service concerns.

## Database vs Service responsibility

**Application Services.**

The currently approved architecture assigns primary selection and publication
validation to the ProductVersion content service. PostgreSQL uniqueness is a
possible later hardening measure only after the exact business scope is frozen.

## Production risk

**LOW**

Ambiguous presentation is undesirable, but it is constrained to guarded draft
editing and publication paths. The risk rises if generic writes or serializers
ignore deterministic ordering and validation.

## Architecture trade-off evaluation

The trade-off is intentional and reasonable. The architecture explicitly
chooses service-level primary selection while ProductDocument multiplicity
remains context-dependent. The audit correctly identifies test obligations but
does not prove that a database uniqueness migration is currently required.

## Recommendation

**Accepted as Service Invariant**

Draft and publication services must enforce at most one primary ProductImage
per ProductVersion, define ProductDocument primary scope per category/locale as
needed, reject unintended duplicate association contexts, and serialize public
content deterministically. Tests must cover multiple-primary rejection,
duplicate-context rejection, legitimate multi-context reuse, and transactional
primary replacement. No schema change is required solely by this finding.

# M-03 — Notification targeting and internal URL semantics

## Restatement

Notification can target a User with no demonstrated relationship to its
Organization, and the action URL CHECK treats any value beginning with `/` as
an internal path, including scheme-relative external URLs beginning with `//`.

## Technical correctness

The finding is technically correct.

The User foreign key proves only that the User exists. It does not prove a
current or historical Membership in the Notification's Organization. The
approved architecture explicitly delegates that relationship check to
application services.

The `ck_notification_action_url_format` condition accepts `//external.example`
because it uses `LIKE '/%'`. In browser URL resolution, that form can identify
an external host, so it does not satisfy the intended internal-path meaning.

## Arguments supporting the audit

- Cross-targeting a User can expose tenant-specific titles, messages, entity
  references, or metadata.
- The Membership relationship is security-sensitive and must be tested at the
  Notification creation boundary.
- Rejecting `//` is a small, stable database rule that directly matches the
  documented distinction between internal paths and explicit HTTPS URLs.
- Defense in depth is valuable because UI code may later treat `actionUrl` as a
  trusted navigation target.
- A database constraint protects privileged scripts and future writers as well
  as the main service.

## Arguments against the audit

- Historical targeting cannot be modeled by a simple current-Membership
  foreign key without changing Notification semantics.
- A direct Membership relation would couple notifications to membership
  lifecycle and was explicitly excluded from the approved model.
- Complete URL parsing, canonicalization, authorization, and redirect safety
  remain application responsibilities.
- A stored URL does not redirect a user by itself; exploitation requires a
  consumer that navigates without validation.
- Notification creation already requires an authenticated tenant-aware service.

## Database vs Service responsibility

**Shared responsibility.**

Application services naturally own current-or-historical Organization/User
eligibility and complete URL validation. PostgreSQL should enforce the stable
lexical distinction that an internal path starts with one slash rather than
two, while continuing to allow explicit HTTPS URLs.

## Production risk

**MEDIUM**

The cross-tenant content risk and potential external navigation are meaningful,
but both require a malformed write and, for navigation, an unsafe consumer.

## Architecture trade-off evaluation

Service-level user targeting was an explicit and reasonable design decision.
Accepting scheme-relative URLs was not an identified architectural goal; it is
an unintended gap in the coarse CHECK expression. Tightening that expression
does not redesign Notification or move full URL validation into the database.

## Recommendation

**Accepted**

Add a reviewed migration that rejects `//` from the internal-path branch while
preserving allowed internal paths and explicit HTTPS URLs. Notification
services must verify the targeted User's appropriate current or historical
Organization relationship and must perform complete navigation-target
validation. Tests must cover cross-Organization targeting, historical-policy
cases, `/path`, `//host`, HTTP, HTTPS, and unsafe schemes.

# M-04 — Billing provider identity and commercial history

## Restatement

Subscription provider identifiers are not unique within a provider and
configuration context, so external events may resolve to more than one
Subscription. Subscription also references a mutable Plan without preserving a
historical snapshot of commercial terms.

## Technical correctness

The finding is technically correct about the schema.

`externalCustomerId` and `externalSubscriptionId` are nullable and indexed
neither uniquely nor as provider-scoped identities. Two Organizations can
therefore persist the same external identifier under the same billing provider
and provider configuration.

Plan is a mutable current configuration row. Subscription does not preserve a
version or commercial snapshot, so the pair cannot prove historical pricing or
terms after Plan edits.

The audit would overreach if it treated Subscription as a required payment
ledger. The architecture expressly limits it to current commercial state and
leaves invoices, settlement, and detailed history to future billing
infrastructure.

## Arguments supporting the audit

- Provider event correlation must identify one tenant and Subscription
  unambiguously.
- Provider and configuration scope are already represented in Subscription and
  can form the natural identity boundary.
- Database uniqueness protects webhook workers, imports, and reconciliation
  jobs from duplicate mappings.
- Ambiguous billing identity can apply entitlements or cancellation to the
  wrong Organization.
- Mutable Plan values cannot serve as durable evidence of historical price or
  contractual terms.

## Arguments against the audit

- No webhook, payment ledger, or provider synchronization implementation is in
  the current database phase.
- External providers may have different uniqueness scopes, and MANUAL
  subscriptions intentionally have no external IDs.
- `providerConfigurationKey` is nullable, so null and non-null configuration
  scopes require an explicit, reviewed uniqueness design.
- IntegrationMapping can represent provider resources, creating an unresolved
  source-of-truth choice that documentation synchronization must settle.
- Historical commercial evidence belongs in future billing-history,
  subscription-period, invoice, or plan-version infrastructure rather than by
  expanding the current Subscription row.

## Database vs Service responsibility

**Shared responsibility.**

The database should enforce whichever provider identity source is declared
authoritative. Services must validate provider/configuration ownership and
process events idempotently. Historical commercial evidence belongs to a
separate future billing model, not to the current Subscription state row.

## Production risk

**MEDIUM**

Provider identity ambiguity can misapply tenant billing state once provider
events are enabled. The immediate risk is lower before that integration exists,
but the identity contract must be resolved before production billing relies on
it.

## Architecture trade-off evaluation

Deferring a payment ledger and historical commercial model is intentional and
reasonable. Leaving the authoritative provider identity location and its
uniqueness unresolved is not a durable freeze decision, particularly because
both Subscription fields and IntegrationMapping are documented as possible
homes for those identifiers.

## Recommendation

**Accepted**

Before Architecture Freeze, choose and document the authoritative location for
subscription/customer provider identity. If the existing Subscription fields
remain authoritative, add provider/configuration-scoped nullable uniqueness
with explicit handling for null configuration and MANUAL subscriptions. Keep
historical commercial terms in separately reviewed future billing
infrastructure; do not turn Subscription into a ledger.

# M-05 — Archived IntegrationMapping uniqueness

## Restatement

IntegrationMapping uniqueness applies to ARCHIVED rows, so an equivalent new
mapping cannot be inserted after archival. The audit argues that replacement
would require mutating the retained row or inventing a different identity.

## Technical correctness

The database observation is correct. Both Prisma composite unique constraints
and the partial indexes for null `externalAccountId` include every status,
including ARCHIVED.

The claimed defect is not established. The approved model defines one retained
lifecycle record for each stable external/internal mapping identity. ARCHIVED
means unavailable for new operations; it is not documented as an immutable
mapping episode that must coexist with a replacement carrying the same
identity.

## Arguments supporting the audit

- If each connection episode must remain immutable, universal uniqueness would
  prevent preserving both old and replacement rows.
- Reactivation clears `archivedAt` under the current consistency CHECK, so the
  row alone no longer records the earlier archive time.
- Provider accounts can be disconnected and later reconnected under changed
  operational circumstances.
- Status-scoped uniqueness is feasible with PostgreSQL partial indexes.

## Arguments against the audit

- The architecture requires one external resource to map to at most one
  Passvero entity and one internal entity to at most one provider resource of
  that type.
- IntegrationMapping is a retained identity record, not a synchronization log,
  connection record, or audit event.
- Reusing the same stable identity does not inherently require a new row.
- Mapping status transitions can be recorded by AuditLog when historical
  transition evidence is needed.
- Allowing replacement rows would create ambiguity about which archived or
  active row owns the stable mapping identity and would require a new episode
  model or explicit supersession semantics.
- No approved requirement states that an archived mapping is immutable or that
  equivalent replacement rows must coexist.

## Database vs Service responsibility

**Application Services.**

Services own reviewed archive, reactivation, or explicit removal workflows for
the stable mapping record. A future immutable-episode requirement would require
new architecture rather than a silent relaxation of uniqueness.

## Production risk

**LOW**

The current model may require reusing the retained mapping row, but it does not
produce ambiguous identity or tenant exposure. Operational friction arises
only if future reconnect semantics require distinct episodes.

## Architecture trade-off evaluation

The trade-off is intentional and reasonable for a stable retained mapping.
Universal uniqueness protects identity across lifecycle states. The audit
assumes replacement-row semantics that the approved architecture does not
contain.

## Recommendation

**Rejected**

No schema or service change is required solely because ARCHIVED mappings retain
their unique identity. Reconnect workflows should reuse or explicitly remove
the stable mapping through reviewed service logic. Reopen the decision only if
the product requires immutable connection episodes or simultaneous historical
rows with the same identity.

# M-06 — BackgroundJob logical references and chronology

## Restatement

BackgroundJob pairs `entityType` and `entityId` but does not validate their
format or nonblank content. Terminal timestamps can precede `startedAt`, and
empty `deduplicationKey` or `lockOwner` values are accepted.

## Technical correctness

The finding is technically correct.

The existing CHECKs enforce queue and job-type format, entity-reference
pairing, status lifecycle, lock pairing, attempts, and timestamps no earlier
than `createdAt`. They do not:

- trim, bound, or normalize `entityType`;
- require nonblank bounded `entityId`;
- prevent an empty `deduplicationKey`;
- prevent an empty `lockOwner`;
- require `completedAt`, `failedAt`, or a post-start `canceledAt` to be no
  earlier than `startedAt`.

Consequently, a terminal job may satisfy every current constraint while its
terminal event predates its required start.

## Arguments supporting the audit

- The documentation explicitly calls `entityType` a normalized uppercase
  String.
- Notification and IntegrationMapping already enforce equivalent logical
  reference formats at the database layer.
- Empty active deduplication keys can collapse unrelated work into the same
  partial unique index key.
- Empty lock owners defeat the operational identification purpose of the
  locking fields.
- Terminal-before-start chronology is impossible under the documented
  lifecycle and is a simple same-row invariant.
- Focused CHECKs protect every worker, import, and maintenance writer without
  implementing queue behavior in PostgreSQL.

## Arguments against the audit

- Application workers must still own state transitions, locking operations,
  retries, and canonical constants.
- `entityId` may represent multiple identifier formats and should not be forced
  to UUID.
- Deduplication-key and lock-owner maximum lengths require an explicit contract
  rather than arbitrary limits.
- CANCELED jobs may have no `startedAt`, so ordering logic must remain
  conditional.
- Constraints cannot prove that a logical entity exists without introducing
  forbidden domain foreign keys.

## Database vs Service responsibility

**Shared responsibility.**

PostgreSQL should enforce stable lexical validity and chronological ordering.
Application services continue to own entity existence, authorization, worker
claims, retries, state transitions, and sanitized value construction.

## Production risk

**MEDIUM**

Malformed operational identity can cause deduplication collisions, obscure lock
ownership, and make execution history unreliable. The impact is operational
rather than a direct domain or tenant-integrity breach.

## Architecture trade-off evaluation

The no-worker/no-scheduler boundary is intentional, but these missing checks do
not implement a worker or scheduler. They complete already documented row-local
contracts and align BackgroundJob with the validation pattern used by other
platform-service models.

## Recommendation

**Accepted**

Add a reviewed migration with format and nonblank constraints for logical
references, deduplication keys, and lock owners, plus conditional terminal-after-
start ordering. Preserve optional logical references, non-UUID entity IDs,
service-controlled transitions, and the absence of triggers, workers, and
schedulers.

# Final Summary

| Finding | Original Severity | Reviewed Severity | Final Decision | Schema Change Required | Future Obligation |
| --- | --- | --- | --- | --- | --- |
| M-01 | MEDIUM | MEDIUM | Accepted | Yes | Define per-model lifecycle truth tables; add narrow consistency and ordering CHECKs while preserving history |
| M-02 | MEDIUM | LOW | Accepted as Service Invariant | No | Guarded primary selection, deterministic serialization, and duplicate-context tests |
| M-03 | MEDIUM | MEDIUM | Accepted | Yes | Reject scheme-relative internal URLs; enforce tenant-aware User targeting and safe navigation in services |
| M-04 | MEDIUM | MEDIUM | Accepted | Yes | Choose authoritative provider identity, enforce scoped uniqueness, and defer commercial history to a separate model |
| M-05 | MEDIUM | LOW | Rejected | No | None solely from this finding; use reviewed lifecycle workflows for the stable mapping identity |
| M-06 | MEDIUM | MEDIUM | Accepted | Yes | Add logical-reference, nonblank identifier, and terminal chronology CHECKs |

After reviewing HIGH and MEDIUM findings together, does any remaining reviewed
finding still block Database Architecture Freeze?

**YES**

The reviewed HIGH findings require no schema change, but accepted MEDIUM
findings M-01, M-03, M-04, and M-06 require reviewed database architecture work
before Freeze. M-02 remains a mandatory application-service release obligation,
and M-05 does not require a change. Low findings and Observations remain pending
and are outside this review.
