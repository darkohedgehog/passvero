# Passvero Single-Operator Recovery Governance Exception

## Decision record

- Status: active under approved temporary single-operator exception
- Scope: Checkpoint 11 recovery governance only
- Effective date: 2026-08-18
- Owner/operator: Passvero owner/operator
- Governance decision: `SINGLE_OPERATOR_TEMPORARY_EXCEPTION`
- Residual risk accepted: yes
- Re-evaluation interval: every 3 months
- First mandatory re-evaluation date: 2026-11-18
- Hard expiry date: 2027-08-18
- Owner/operator self-review completed: 2026-08-18
- Independent review performed: **NO**

This record does not claim, simulate, or substitute an independent review. It records a temporary exception for Passvero's genuine single-operator stage.

## Scope and reason

Passvero currently has one technical owner/operator and no qualified second reviewer. The complete technical recovery gate has passed, including recurring encrypted offsite backups, freshness and failure alerting, and an isolated restore drill from a real offsite snapshot. Blocking recovery governance indefinitely would not add a reviewer; it would leave an otherwise tested recovery system without a completed, deterministic global-state runbook.

The exception therefore waives only the requirement for a second person to review the disaster-recovery governance package during the documented single-operator stage. It does not waive:

- any technical backup, restore, validation, or anti-production gate;
- review requirements for database migrations, privileges, application changes, or deployment work;
- legal, regulatory, contractual, audit, or segregation-of-duties requirements;
- the requirement to obtain independent review when any trigger below occurs.

## Policy classification

The following repository sources were reviewed:

- `codex/PRODUCTION_POSTGRESQL_READINESS_REVIEW.md` requires named operator/reviewer sign-off for production database readiness;
- `docs/superpowers/plans/2026-08-13-production-postgresql-roles-grants.md` requires named operator and reviewer evidence for the production privilege procedure;
- `codex/DATABASE_PRODUCTION_AUDIT.md` requires recovery evidence, RPO/RTO decisions, restore proof, and an operational runbook;
- `codex/PRISMA_RUNTIME_MIGRATION_AUDIT.md` requires technical recovery and security controls and recommends ownership/rehearsal;
- `codex/SECURITY.md` contains no separate immutable segregation-of-duties rule for this recovery gate.

Classification: independent review is explicit in the current Checkpoint 11 gate and named reviewer/sign-off is explicit in portions of the readiness and privilege material. It is implied as a desirable assurance control elsewhere, but it is not established as a universal, exception-proof repository policy. The recovery audit requirements themselves are primarily evidence-based. No repository policy reviewed for this amendment explicitly prohibits a documented exception, and no applicable legal or regulatory requirement was identified in the repository.

The independent-review requirement serves valid purposes: separation of duties, detection of confirmation bias and runbook errors, verification of secret escrow and recovery assumptions, and stronger audit evidence. Those purposes remain acknowledged even though a temporary exception is approved.

## Options considered

### Option A — Keep independent review mandatory

This provides the strongest governance posture. Checkpoint 11 would remain blocked until a qualified reviewer becomes available. It was not selected because no such reviewer currently exists and the technical recovery controls are complete.

### Option B — Temporary single-operator exception

This preserves the requirement as a future obligation while allowing the recovery governance gate to close after explicit risk acceptance, compensating controls, and operator self-review. This option was selected as proportionate to the current project stage.

### Option C — Permanently remove independent review

This would remove an important control as Passvero grows and would create avoidable governance and audit risk. It was rejected.

## Residual risk

### Technical risk: low to medium

The tested recovery path and deterministic verification procedures materially reduce technical recovery risk. Residual risk remains that the same operator who authored the runbook may miss an error, stale assumption, or incomplete global-state dependency.

### Governance and audit risk: medium

There is no segregation of duties and no independent corroboration of the evidence. This weakens auditability and increases confirmation-bias risk. The operator is also a key-person dependency: availability during an incident and knowledge concentration remain material concerns.

### Credential risk

Recovery credentials are concentrated operationally around one owner. Independent secret escrow outside the VPS is verified, but single-person access and recovery availability remain residual risks. No secret is recorded in this amendment or the runbook.

## Compensating controls

The exception is valid only while all of the following remain true:

1. The complete technical recovery gate remains passed.
2. Production backups remain encrypted and stored offsite.
3. A real offsite restore drill remains successfully evidenced.
4. Recovery duration remains measured and compared with the approved RTO.
5. Maximum data loss of 24 hours remains formally accepted.
6. Maximum service recovery time of 4 hours remains formally accepted.
7. Required recovery secrets remain escrowed independently outside the production VPS.
8. Cluster-global roles and database-level ACLs are recoverable through the deterministic, secret-free bootstrap runbook.
9. Ownership, ACL, migration, catalog, and exact row-count verification procedures remain documented.
10. Protected, traceable recovery evidence is retained for 12 months.
11. The operator completes the formal self-review checklist below.
12. The owner/operator explicitly accepts the residual technical, key-person, governance, and audit risk.
13. No unresolved Critical or Important technical recovery finding exists.
14. This exception is re-evaluated every 3 months and never auto-renews past its hard expiry.
15. Independent review becomes mandatory at the earliest trigger below.

## Independent-review and revocation triggers

The exception ends at the earliest of:

- a second qualified technical operator joining the project;
- before the first paying production customer is onboarded;
- a security incident affecting credentials, database integrity, backups, or recovery capability;
- a material change to the database, privileged-role, backup, or recovery architecture, including introduction of WAL archiving or PITR;
- a regulatory, contractual, external-audit, or certification requirement for independent review or segregation of duties;
- the hard expiry date, 2027-08-18.

The exception is immediately suspended if secret escrow is no longer verified, recovery evidence is materially invalidated, an unresolved Critical or Important recovery finding appears, the technical recovery gate fails, or any approved compensating control is materially weakened.

Re-evaluation is required every 3 months. The first review is due 2026-11-18. A periodic re-evaluation may continue the exception only if no termination trigger has occurred, all controls remain effective, and the owner/operator records a new dated risk acceptance. It cannot extend the hard expiry.

## Approved recovery governance decisions

- `APPROVE_RPO_MAX_DATA_LOSS_HOURS=24`
- `APPROVE_RTO_MAX_SERVICE_RECOVERY_HOURS=4`
- `RECOVERY_EVIDENCE_RETENTION_MONTHS=12`
- `GLOBAL_ROLE_RECOVERY_STRATEGY=DOCUMENTED_BOOTSTRAP`
- `RECOVERY_SECRET_ESCROW_STATUS=VERIFIED`
- `GOVERNANCE_EXCEPTION_DECISION=SINGLE_OPERATOR_TEMPORARY_EXCEPTION`
- `SINGLE_OPERATOR_RESIDUAL_RISK_ACCEPTED=YES`
- `SINGLE_OPERATOR_EXCEPTION_REVIEW_MONTHS=3`

The independent-review trigger approved by the operator is the earliest of a second technical operator, first paying production customer, security incident, material database or recovery architecture change, regulatory or external-audit requirement, or 12-month hard expiry.

## Recovery evidence and runbook

- Checkpoint 10 evidence: `/var/lib/passvero-backup/evidence/passvero-restore-drill-20260818T145708Z.evidence` on the production VPS, protected as `root:root` mode `0600`
- Tested snapshot: `0c65660c6e55641efa4a3fa40fd53afdbc2b24b51edf1d6f23f99cacece891bf`
- Backup set: `20260818T020055Z`
- Measured database recovery and validation duration: 1,695.365 seconds (28 minutes 15.365 seconds)
- Canonical runbook: [Passvero PostgreSQL Disaster Recovery](../runbooks/passvero-postgresql-disaster-recovery.md)

## Required operator self-review

The following review must be completed by the owner/operator. It is a self-review and must never be represented as independent review.

- [x] Confirm the role bootstrap templates match the read-only production inventory.
- [x] Confirm database ownership and database-level ACL recreation commands match the production posture.
- [x] Confirm the localhost-only and SCRAM `pg_hba.conf` recovery model.
- [x] Confirm every required secret has an independent recovery source and no secret appears in documentation.
- [x] Confirm snapshot selection, retrieval, checksum, archive-list, and restore steps use the encrypted offsite copy.
- [x] Confirm hard anti-production restore gates prevent accidental targeting of an existing production or test database.
- [x] Confirm ownership, runtime ACL, backup ACL, default ACL, PUBLIC hardening, catalog, migration, and exact row-count checks.
- [x] Confirm approved RPO, approved RTO, and the distinction between database restore time and full-service recovery time.
- [x] Confirm abort, rollback, cleanup, and evidence requirements.
- [x] Confirm the exception triggers, re-evaluation dates, and 12-month hard expiry.

## Owner/operator approval statement

The Passvero owner/operator approved the temporary single-operator exception and explicitly accepted its residual risk on 2026-08-18. The owner/operator completed the ten-section self-review and submitted the formal confirmation block on 2026-08-18. Approval does not state that independent review occurred. The exception is active only while every compensating control and review condition remains satisfied.
