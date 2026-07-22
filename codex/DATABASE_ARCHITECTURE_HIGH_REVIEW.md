# Passvero Database Architecture HIGH Findings Review

Review date: 2026-07-22

# Executive Summary

All three HIGH findings are factually grounded, but the original audit does not
fully distinguish a database-enforceable structural defect from an explicitly
assigned application-service invariant.

H-01 and H-02 describe states PostgreSQL currently accepts. That technical fact
is not disputed. However, the architecture explicitly names those exact rules,
assigns them to transactional application services, and explains why inherited
ownership is not duplicated on every child. Enforcing them in PostgreSQL would
require composite-key expansion, redundant ownership columns, or triggers, and
would still not replace service enforcement of status and workflow rules. Both
findings are therefore real invariants but overclassified as HIGH database
architecture defects.

H-03 identifies genuine documentation drift. It is a maintainability and
governance defect, but it does not alter the applied schema, migrations, or
runtime referential integrity. Treating it as a HIGH database-integrity problem
conflates documentation synchronization with database design.

Peer-review outcome:

- H-01: **Accepted as Service Invariant**, recommended severity MEDIUM
- H-02: **Accepted as Service Invariant**, recommended severity MEDIUM
- H-03: **Rejected** as a HIGH database finding, recommended severity LOW

# H-01 — Product ownership and publication pointers

## Restatement

`ProductVersion.productId` and `ProductVersion.organizationId` can reference a
Product and Organization that do not correspond. `Passport.productId` and
`Passport.organizationId` have the same possibility. Product's current draft
and published pointers can reference a ProductVersion belonging to another
Product or carrying the wrong lifecycle status.

## Technical correctness

The finding is technically correct about accepted database states.

The foreign keys independently prove that each referenced row exists. They do
not prove:

- `ProductVersion.organizationId = Product.organizationId`;
- `Passport.organizationId = Product.organizationId`;
- a current-version pointer references a version whose `productId` equals the
  pointing Product's ID;
- the draft pointer references DRAFT/READY_FOR_REVIEW;
- the published pointer references PUBLISHED.

The schema comments acknowledge the first three rules rather than claiming
database enforcement.

## Arguments supporting the audit

- Organization is the tenant boundary, so contradictory ownership paths are
  security-sensitive rather than cosmetic.
- Public Passport resolution follows the current published pointer; an invalid
  pointer can select content from the wrong Product.
- Direct database imports, administrative scripts, or a defective repository
  can bypass application validation.
- PostgreSQL can enforce part of the equality problem through composite unique
  keys and composite foreign keys.
- A future policy that trusts direct `organizationId` could disagree with a
  parent-derived ownership path.

## Arguments against the audit

- `DATABASE_ARCHITECTURE.md` explicitly enumerates every equality in this
  finding under Cross-Organization Invariants and requires transactional
  application-service validation.
- ADR-006 assigns authoritative private ownership enforcement to server-side
  application code. The schema is not presented as the sole authorization
  boundary.
- Product creation, draft creation, and publication are explicitly defined as
  transactions that create/update the version and pointers together.
- Composite enforcement would add extra unique keys and more complex Prisma
  relations. It can enforce ID equality but cannot naturally enforce pointer
  status; that workflow rule would still require services or triggers.
- Status-dependent pointer correctness changes during a publication transaction.
  Keeping the complete transition in one service avoids splitting a single
  invariant across unrelated mechanisms.
- The original finding moves from “the database permits this” to “the database
  architecture is defective” without proving that the documented service
  boundary is unreasonable.

## Database vs Service responsibility

**Shared responsibility.**

The database should continue to enforce existence, cardinality, uniqueness,
and conservative referential actions. Transactional services naturally own
same-aggregate equality, permitted pointer status, transition ordering, and
authorization. Database composite keys would be defensible hardening, but they
are not required to make the chosen architecture coherent.

## Production risk

**MEDIUM**

Impact would be high if the invariant were violated, but the architecture has a
clear control point: all writes must pass through tenant-aware transactional
services. The practical risk becomes HIGH only if generic repositories, imports,
or privileged scripts are allowed to write these relations without the same
validation.

## Architecture trade-off evaluation

The trade-off is intentional and reasonable. It favors a readable Prisma model
and centralized publication workflow over composite relation expansion and
partial database enforcement. Its reasonableness depends on mandatory service
tests and the absence of unguarded write paths; those are application-phase
obligations, not evidence that the current schema was accidentally designed.

## Recommendation

**Accepted as Service Invariant**

The current schema is acceptable. ProductVersion ownership, Passport ownership,
pointer ownership, and pointer status must be enforced atomically by the
publication and draft services. Integration tests must attempt cross-Product and
cross-Organization assignments. No database change is justified solely by this
finding.

# H-02 — ProductDocument cross-tenant ownership

## Restatement

`ProductDocument.productVersionId` and `ProductDocument.documentId` can reference
parents from different Organizations because the join row has no direct
`organizationId` and the two ordinary foreign keys do not compare parent
ownership.

## Technical correctness

The finding is technically correct. PostgreSQL accepts the cross-Organization
association because both parents independently exist. Prisma relations and the
current foreign keys cannot express equality between columns reached through
two different parent rows.

The schema comment, `PRISMA_DOMAIN_MODEL.md`, and `DATABASE_ARCHITECTURE.md` all
state that the associated Document must belong to the ProductVersion's
Organization and that services must verify this before insertion.

## Arguments supporting the audit

- Cross-Organization document reuse is expressly forbidden.
- A public association could make another tenant's file eligible for Passport
  output if a later query trusts the relation.
- The impact is confidentiality-sensitive and may not be obvious from the join
  row itself.
- Database enforcement would protect against every writer, including imports
  and maintenance scripts.
- PostgreSQL could enforce equality by adding `organizationId` to
  ProductDocument and using composite foreign keys to both parents, or by using
  a trigger.

## Arguments against the audit

- This is the exact example that the architecture assigns to a transactional
  Document-association service; it is not an undocumented omission.
- ProductDocument intentionally inherits ownership through ProductVersion.
  Adding direct ownership would duplicate tenant identity and create a new
  consistency surface on every association row.
- A PostgreSQL CHECK constraint cannot query both parent tables. Without a
  redundant ownership column, enforcement requires a trigger, which the
  architecture avoids for service workflows.
- Composite foreign keys require composite unique keys on both parents and
  more complex Prisma relation definitions for a single association invariant.
- The same service must also verify Document availability, published-version
  immutability, authorization, and public visibility. Database equality would
  not eliminate the service boundary.
- Public document delivery must independently authorize the resolved Document;
  it must not treat association existence as sufficient authorization.

## Database vs Service responsibility

**Shared responsibility, with application services as the natural equality
owner.**

The database correctly protects parent existence and prevents Document deletion
while associations remain. The association service naturally owns tenant
equality because it already owns authorization, availability, and version-state
validation.

## Production risk

**MEDIUM**

The consequence of violation is serious, but the write operation is narrow and
explicitly transactional. Risk remains controlled if there is one guarded
association path and public download resolution independently verifies tenant
and publication eligibility. It becomes HIGH if generic create access or bulk
imports bypass that path.

## Architecture trade-off evaluation

The trade-off is intentional and reasonable for the approved aggregate model.
It preserves inherited ownership and avoids adding a redundant tenant column or
trigger solely to compare two aggregate roots. The trade-off requires strict
service encapsulation; it is not permission to rely on client-supplied IDs.

## Recommendation

**Accepted as Service Invariant**

The current schema is acceptable. The ProductDocument creation service must load
both parents under the authenticated Organization, verify equality in the same
transaction, and reject cross-tenant pairs. Tests must cover private and public
document paths. No database change is justified solely by this finding.

# H-03 — Documentation drift

## Restatement

Several authoritative documents contain older field names, statuses, ownership
paths, model shapes, and implementation-state descriptions that differ from the
reviewed schema and applied migrations.

## Technical correctness

The observation is technically correct. Confirmed examples include:

- old Document and Subscription status vocabularies;
- ProductDocument `visibility` guidance versus implemented `isPublic`;
- an asset-based ProductImage example versus embedded storage metadata;
- obsolete direct ScanEvent ownership descriptions;
- ScanEvent, AuditLog, Billing, and Platform models still labeled planned;
- BackgroundJob still marked current after its migration was applied.

The drift is real. The disputed point is its classification as a HIGH database
architecture defect.

## Arguments supporting the audit

- `PRISMA_DOMAIN_MODEL.md` calls itself authoritative and canonical for schema
  generation, so direct conflicts are hazardous.
- A future engineer can reasonably follow a stale canonical field list and
  reintroduce removed enums or relations.
- Architecture Freeze should leave one comprehensible, internally consistent
  contract.
- The drift spans multiple domains rather than one isolated roadmap checkbox.

## Arguments against the audit

- Documentation drift does not change database state, referential integrity, or
  runtime tenant isolation.
- The applied migrations, Prisma schema, focused tests, and migration hash tests
  agree on the implemented structure.
- `DOMAIN_RULES.md` expressly says it does not define the final Prisma schema,
  and many older passages are phrased as potential or recommended designs.
- ADR-008 through ADR-011 agree with the implemented aggregate boundaries,
  including ProductVersion ownership, reusable Documents, Passport-owned QRCode,
  and QRCode-owned ScanEvent.
- The audit correctly requests documentation synchronization, not a database
  change. That remedy demonstrates that the finding is governance drift rather
  than a defective schema.
- Assigning HIGH production database risk overstates the immediate effect while
  schema and migration tests remain the executable contract.

## Database vs Service responsibility

**Neither. This is documentation governance.**

The issue should be corrected through a scoped documentation synchronization.
It does not belong in PostgreSQL or application-service runtime logic.

## Production risk

**LOW**

There is negligible immediate runtime risk because the deployed structure and
tests are aligned. The longer-term maintenance risk is real: stale guidance can
cause a future incorrect change. That risk warrants cleanup before relying on
the documents for new implementation, but not a database redesign.

## Architecture trade-off evaluation

The drift does not appear to be an intentional architecture trade-off. It is a
by-product of incremental, narrowly scoped phase documentation updates. The
underlying implemented decisions are nevertheless recoverable and consistent
from schema, migrations, tests, and current ADRs.

## Recommendation

**Rejected**

Reject H-03 as a HIGH database architecture finding. The factual documentation
drift should still be resolved in a documentation-only task, but it does not
justify changing the database and does not demonstrate structural corruption of
the implemented architecture.

# Final Summary

| Finding | Original Severity | Recommended Severity | Recommendation |
| --- | --- | --- | --- |
| H-01 | HIGH | MEDIUM | Accepted as Service Invariant |
| H-02 | HIGH | MEDIUM | Accepted as Service Invariant |
| H-03 | HIGH | LOW | Rejected |

After reviewing only HIGH findings, is the database still blocked from
Architecture Freeze?

**NO**

H-01 and H-02 are explicitly documented transactional service invariants whose
current allocation is architecturally reasonable. H-03 is real documentation
debt but not a HIGH database defect. Based only on these three findings, no
database-schema change is required before Architecture Freeze. Documentation
synchronization remains advisable before the frozen architecture is used as the
authoritative starting point for later implementation.
