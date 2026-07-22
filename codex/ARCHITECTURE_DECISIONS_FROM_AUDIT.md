# Passvero Architecture Decisions From Database Audit

Audit date: 2026-07-22

Decision-register creation date: 2026-07-22

## Document purpose

This document is the durable decision register for findings raised by the
Passvero database structural audit. It records which reviewed findings the
project accepts, delegates to application services, rejects, or still needs to
review.

Reviewed source documents:

- `codex/DATABASE_ARCHITECTURE_AUDIT.md`
- `codex/DATABASE_ARCHITECTURE_HIGH_REVIEW.md`
- `codex/DATABASE_ARCHITECTURE_MEDIUM_REVIEW.md`
- `codex/DATABASE_ARCHITECTURE_BLOCKING_MEDIUM_REVIEW.md`
- `codex/DATABASE_ARCHITECTURE_LOW_OBSERVATIONS_REVIEW.md`

Current decision status: all HIGH, Medium, LOW, and Observation findings have
completed formal review.

This register must be read together with the original audit, peer-review
reports, ADRs, committed Prisma schema, and applied migrations. It does not
replace any of those sources.

This document records final project decisions. The original audit records
risks. The peer-review documents evaluate those risks. This register records
what the Passvero architecture officially accepts, delegates, rejects, or still
needs to review.

# Decision vocabulary

## Accepted

The finding is valid and requires a change to architecture, schema,
documentation, tests, or implementation before Architecture Freeze.

## Accepted as Service Invariant

The finding identifies a real invariant, but the current database architecture
intentionally assigns enforcement to authenticated, transactional application
services.

No schema change is required solely because of the finding.

The service obligation must be implemented and tested before the relevant
application feature is considered production-ready.

## Rejected

The finding may be technically observable, but it is not considered an
architectural defect in the context of Passvero.

No schema or service change is required solely because of the finding.

A rejected database classification does not necessarily mean that related
documentation or maintenance work should be ignored.

## Confirmed

The observation accurately describes the architecture and requires no further
action before Architecture Freeze.

## Confirmed with Future Obligation

The observation accurately describes the architecture and does not block
Architecture Freeze, but it creates a specific future implementation,
authorization, testing, documentation, or operational obligation.

## Pending Review

No final project decision has yet been made.

# Current summary

| Finding | Original severity | Reviewed severity | Final decision | Schema change required | Future obligation |
| --- | --- | --- | --- | --- | --- |
| H-01 | HIGH | MEDIUM | Accepted as Service Invariant | No | Transactional Product/ProductVersion/Passport ownership and pointer-validation services with cross-tenant and cross-product tests |
| H-02 | HIGH | MEDIUM | Accepted as Service Invariant | No | Guarded ProductDocument association service, independent public-document authorization, and mandatory cross-tenant rejection tests |
| H-03 | HIGH | LOW | Rejected as a database architecture finding | No | Documentation-only synchronization before final Architecture Freeze |

# Formal decisions

## H-01 — Product ownership and publication pointers

### Final decision

Accepted as Service Invariant

### Technical fact accepted

The database independently validates referenced rows but does not guarantee:

- ProductVersion and Product belong to the same Organization;
- Passport and Product belong to the same Organization;
- current draft and published pointers belong to the same Product;
- current pointers carry the expected lifecycle status.

### Architecture rationale

- This was an intentional architecture choice.
- Ownership and workflow equality are transactional business invariants.
- Composite foreign keys would add schema and Prisma complexity.
- Composite keys would still not fully enforce pointer lifecycle status.
- Application services remain necessary even if partial database hardening were
  added.
- The current trade-off is acceptable only if all writes are encapsulated.

### Mandatory future service obligations

1. ProductVersion creation must derive and verify Organization ownership from
   the Product.
2. Passport creation and updates must verify Product ownership.
3. Draft and published pointers must reference versions belonging to the same
   Product and Organization.
4. Draft pointers may reference only approved editable statuses.
5. Published pointers may reference only PUBLISHED versions.
6. These operations must be transactional.
7. Cross-Organization and cross-Product assignment tests are mandatory.
8. Generic or unguarded repository writes must not bypass these checks.
9. Imports and administrative scripts must use the same invariant-validation
   layer or equivalent reviewed validation.

### Freeze effect

- No schema change is required.
- This finding does not block Database Architecture Freeze.
- The service obligations become release gates for the affected application
  features.

## H-02 — ProductDocument cross-tenant ownership

### Final decision

Accepted as Service Invariant

### Technical fact accepted

PostgreSQL currently permits a ProductDocument whose ProductVersion and
Document belong to different Organizations because both foreign keys are
independently valid.

### Architecture rationale

- Cross-Organization Document association is prohibited.
- ProductDocument intentionally inherits tenant ownership through
  ProductVersion.
- Adding `organizationId` to ProductDocument would duplicate tenant identity.
- Composite foreign keys would require additional composite uniqueness and
  more complex Prisma relations.
- A CHECK constraint cannot compare ownership across two parent tables.
- Trigger-based enforcement is intentionally avoided for application workflow.
- The ProductDocument association service already needs to enforce
  authorization, document availability, version mutability, and publication
  rules.
- Tenant equality therefore belongs in the same transactional service.

### Mandatory future service obligations

1. ProductDocument creation must load ProductVersion and Document under the
   authenticated Organization.
2. Both parent Organizations must match.
3. Cross-Organization associations must be rejected in the same transaction.
4. Published or otherwise immutable ProductVersions must reject unauthorized
   association changes.
5. Public Passport serialization must not trust association existence alone.
6. Public document delivery must independently verify:
   - organization ownership;
   - ProductVersion relationship;
   - document visibility;
   - Passport/publication eligibility.
7. Tests must include:
   - same-Organization success;
   - cross-Organization rejection;
   - private-document exclusion;
   - public-document inclusion;
   - attempts to access another tenant's storage asset.
8. This test group is a release blocker for ProductDocument and public Passport
   document functionality.
9. Bulk imports and administrative tools must use the guarded association
   service or equivalent reviewed validation.

### Freeze effect

- No schema change is required.
- This finding does not block Database Architecture Freeze.
- Production readiness of document association and public delivery remains
  blocked until the service obligations and tests exist.

## H-03 — Authoritative documentation drift

### Final decision

Rejected as a database architecture finding

### Technical fact accepted

Genuine documentation drift exists across older domain, naming, architecture,
and roadmap sections.

### Architecture rationale

- Documentation drift does not change deployed schema or referential integrity.
- The schema, migrations, focused tests, and migration hashes agree.
- The issue is documentation governance rather than database structure.
- Classifying it as HIGH database risk overstates its immediate runtime effect.
- The issue must still be resolved before the documents are treated as a frozen
  long-term implementation contract.

### Mandatory future documentation obligation

A documentation-only synchronization must cover all implemented domains,
including at minimum:

- Document;
- ProductDocument;
- ProductImage;
- QRCode;
- ScanEvent;
- AuditLog;
- Plan;
- Subscription;
- Notification;
- IntegrationMapping;
- BackgroundJob;
- implemented model inventory;
- roadmap completion state.

The synchronization must use the committed Prisma schema, applied migration
history, current ADRs, and reviewed implementation decisions as authoritative
references.

The cleanup must not silently change intended architecture. Any proposed schema
change discovered during synchronization must be handled as a separate reviewed
architecture task.

### Freeze effect

- No schema change is required.
- H-03 does not block freeze as a database defect.
- Final documentation synchronization remains a governance prerequisite before
  issuing the final Architecture Freeze document.

# Medium Findings

## M-01 — Core lifecycle rows

- Final decision: Accepted as Service Invariant
- Reviewed severity: MEDIUM
- Schema change required: No
- Future obligation: lifecycle services must validate status/timestamp
  consistency and ordering transactionally. Transition tests must cover every
  approved path and malformed combinations, and no generic lifecycle writer may
  bypass the invariant layer.

## M-02 — Primary media and association multiplicity

- Final decision: Accepted as Service Invariant
- Reviewed severity: LOW
- Schema change required: No
- Future obligation: draft and publication services must enforce one primary
  ProductImage, define ProductDocument primary scope, reject unintended
  duplicate contexts, and serialize deterministically. Tests must cover
  multiple-primary rejection, duplicate-context rejection, legitimate
  multi-context reuse, and transactional primary replacement.

## M-03 — Notification targeting and internal URL semantics

- Final decision: Accepted as Service Invariant
- Reviewed severity: MEDIUM
- Schema change required: No
- Future obligation: services must verify the targeted User's current or
  historical Organization relationship, validate and normalize navigation
  targets, and use safe URL consumption. Cross-tenant, scheme-relative, unsafe
  scheme, and consumer tests are mandatory.

## M-04 — Billing provider identity and commercial history

- Final decision: Rejected
- Reviewed severity: MEDIUM
- Schema change required: No
- Future obligation: none for the current schema solely from this finding.
  Provider-backed billing must define authoritative identity, idempotency, and
  configuration scope before release. Historical commercial evidence belongs
  to separately reviewed future billing infrastructure, not Subscription.

## M-05 — Archived IntegrationMapping uniqueness

- Final decision: Rejected
- Reviewed severity: LOW
- Schema change required: No
- Future obligation: none solely from this finding. The approved model retains
  one stable mapping identity across lifecycle states; reviewed services may
  reactivate or explicitly remove it. A replacement-row model requires a new
  product requirement and architecture review.

## M-06 — BackgroundJob logical references and chronology

- Final decision: Accepted as Service Invariant
- Reviewed severity: MEDIUM
- Schema change required: No
- Future obligation: job creation and worker services must normalize logical
  references, null absent deduplication keys, require nonblank worker identity,
  and enforce transactional chronology. Negative-path tests are mandatory
  before job processing is production-ready.

## Medium Findings Summary

| Finding | Original Severity | Reviewed Severity | Final Decision | Schema Change Required | Future Obligation |
| --- | --- | --- | --- | --- | --- |
| M-01 | MEDIUM | MEDIUM | Accepted as Service Invariant | No | Enforce lifecycle consistency and ordering in transactional services and tests |
| M-02 | MEDIUM | LOW | Accepted as Service Invariant | No | Enforce primary selection and contextual multiplicity in guarded services and tests |
| M-03 | MEDIUM | MEDIUM | Accepted as Service Invariant | No | Enforce tenant-aware targeting and safe URL validation and consumption in services |
| M-04 | MEDIUM | MEDIUM | Rejected | No | Resolve provider identity and history only with future billing infrastructure |
| M-05 | MEDIUM | LOW | Rejected | No | None solely from this finding; preserve stable mapping identity |
| M-06 | MEDIUM | MEDIUM | Accepted as Service Invariant | No | Enforce job normalization and chronology in creation and worker services |

# LOW Findings

## L-01 — Normalization-sensitive uniqueness relies on writers

- Final decision: Accepted as Service Invariant
- Reviewed classification: LOW
- Schema change required: No
- Future obligation: canonical application writers, imports, administrative
  tools, and maintenance scripts must apply field-specific normalization before
  persistence. Tests must cover normalized duplicates and intentional
  case-sensitive identifiers.
- Freeze effect: retain normalization as an explicit service boundary; this
  finding does not block Database Architecture Freeze.

## L-02 — Append-only and published-immutability guarantees

- Final decision: Accepted as Service Invariant
- Reviewed classification: LOW
- Schema change required: No
- Future obligation: restricted repositories, least-privilege runtime database
  roles, transactional publication guards, negative mutation tests, and
  controlled maintenance procedures must preserve append-only AuditLog and
  ScanEvent records and immutable published ProductVersion aggregates.
- Freeze effect: retain layered immutability as an explicit service and
  operational boundary; this finding does not block Database Architecture
  Freeze.

## LOW Findings Summary

| Finding | Original classification | Reviewed classification | Final decision | Schema change required | Future obligation |
| --- | --- | --- | --- | --- | --- |
| L-01 | LOW | LOW | Accepted as Service Invariant | No | Enforce field-specific normalization through every canonical writer and test normalized duplicates |
| L-02 | LOW | LOW | Accepted as Service Invariant | No | Enforce append-only and published immutability through services, permissions, tests, and controlled maintenance |

# Observations

## O-01 — Product/ProductVersion FK cycle

- Final decision: Confirmed with Future Obligation
- Reviewed classification: OBSERVATION
- Schema change required: No
- Future obligation: Product creation and pointer assignment must use the
  transactional create-then-point sequence, with rollback and invalid-pointer
  tests. The final Freeze document must record the intentional nullable-pointer
  cycle.
- Freeze effect: the cycle is deliberate and operationally manageable; it does
  not block Database Architecture Freeze.

## O-02 — Aggregate cascade paths

- Final decision: Confirmed with Future Obligation
- Reviewed classification: OBSERVATION
- Schema change required: No
- Future obligation: any future destructive aggregate workflow must be
  explicitly authorized and must include impact preview, retention review,
  auditability, and cascade-path tests. Retained external resources remain
  protected by Restrict boundaries.
- Freeze effect: the cascade graph is aggregate-aligned and does not block
  Database Architecture Freeze.

## O-03 — Partial unique indexes

- Final decision: Confirmed
- Reviewed classification: OBSERVATION
- Schema change required: No
- Future obligation: re-review each predicate if a future lifecycle or active
  scope changes; no additional work is required for the current architecture.
- Freeze effect: the indexes correctly enforce scoped active-state uniqueness
  and do not block Database Architecture Freeze.

## O-04 — Platform-service boundaries

- Final decision: Confirmed with Future Obligation
- Reviewed classification: OBSERVATION
- Schema change required: No
- Future obligation: later platform-service work must preserve the separation
  between AuditLog, Notification, IntegrationMapping, BackgroundJob, and
  ScanEvent, using separately reviewed models and ADRs when responsibilities
  materially expand. Focused boundary tests must remain in place.
- Freeze effect: the current boundaries are intentional and do not block
  Database Architecture Freeze.

## Observations Summary

| Item | Original classification | Reviewed classification | Final decision | Schema change required | Future obligation |
| --- | --- | --- | --- | --- | --- |
| O-01 | OBSERVATION | OBSERVATION | Confirmed with Future Obligation | No | Preserve transactional create-then-point handling and document the intentional cycle |
| O-02 | OBSERVATION | OBSERVATION | Confirmed with Future Obligation | No | Guard future destructive workflows with preview, retention, audit, and cascade tests |
| O-03 | OBSERVATION | OBSERVATION | Confirmed | No | Re-review predicates only if lifecycle scopes change |
| O-04 | OBSERVATION | OBSERVATION | Confirmed with Future Obligation | No | Preserve platform-service separation in future models, ADRs, and tests |

# Current Architecture Freeze status

- All structural audit findings and observations have completed formal review.
- Architecture Freeze is not yet approved.
- No reviewed HIGH, Medium, LOW, or Observation item requires a database schema
  change before Freeze.
- Accepted Service Invariants remain production-release gates for their
  affected features.
- Documentation synchronization remains pending.
- Database Production Audit remains pending.
- The final Freeze document must record the accepted service invariants,
  intentional FK cycle, guarded cascade consequences, and platform-service
  boundaries.
- Final Freeze approval remains pending.

Database Architecture Freeze v1.0 has not been approved.

# Governance rules

1. Accepted Service Invariants must be represented in application-service
   design and tests before production release of the relevant feature.
2. Future generic repositories must not expose write operations that bypass
   tenant and aggregate invariants.
3. Imports, background processes, administration tools, and maintenance scripts
   are not exempt from service invariants.
4. A future decision to move a service invariant into PostgreSQL requires a new
   reviewed migration and, where architecturally significant, a new ADR.
5. Rejected findings may be reopened only with new evidence, changed
   requirements, a production incident, or a materially different threat model.
6. This register must remain synchronized with any subsequent formal review.
7. Final Architecture Freeze must reference the completed version of this
   register.
