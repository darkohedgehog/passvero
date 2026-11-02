# Historical production evidence archive — DO NOT EXECUTE

This is a proposed archive of accepted historical evidence, not a deployment runbook.
The current production runbook remains docs/superpowers/runbooks/passvero-production-release.md.
All SQL, patches, preparation states, source hashes and old operator records here are frozen
historical artifacts. **Do not run, apply, install, prepare, activate, close or replay them.**
No new runtime, guardian, supervisor, adapter, migration or recovery task follows from archival.
The legal draft and mixed open roadmap work are not part of this archive commit.

Raw records retain their original status/date/release/path. A field such as NOT_EXECUTED,
PENDING or approvedForExecution=false describes its original phase; archiving never changes
that status or promotes it to current authority. W1/W2 passes remain isolated proof, not live
production proof. The70-grant SQL has the exact source hash previously reported committed;
its original preparation comments are not rewritten and it must not be replayed blindly.

Base documentation commit: b0000a11869bebe2f4a57f2ab0f63cd6200234c9.
Production build stays2eaa5a54770843828e0aae4c16f71bae4927c12b.
Admin inbox acceptance stays PENDING_USER_CONFIRMATION.

## Exact retained original files

- `codex/archive/production-20261101/files/codex/evidence/production-deployment-20261101/notification-policy-origin-review/git-push-and-operator-preparation-result.json` — Published source SHA and original operator block pins; references are historical metadata, canonical blocks already in Git.
- `codex/archive/production-20261101/files/codex/evidence/production-deployment-20261101/notification-policy-origin-review/manifest.json` — Reviewed origin-isolation source/test hashes and focused proof; original preparation status retained.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/acl-stdin-access-fix-20261101.json` — Historical root-private SQL read failure and pinned stdin correction preparation; not a new execution authorization.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/documented-test-role-operator-result-20261101.json` — Exact fifth-role attributes/no membership or production ownership evidence.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/production-default-acl-namespace-operator-result-20261101.json` — Observed global/public default ACL scope; protects against candidate namespace assumptions.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/production-pre-ddl-return-complete-stop-20261101.json` — Complete old-code/config/timer return without DB restore.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/production-pre-mutation-target-stop-operator-result-20261101.json` — Exact production C.UTF-8/NOINHERIT mismatch and pre-mutation STOP.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/production-preservation-accepted-20261101.json` — Original preliminary disk-preservation identity and explicit non-final/non-runtime-rollback limits.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/git-pm2-source-review-20261101/runtime-acl.production-20261101.sql` — Exact SHA1265f2... of the reviewed/executed70-grant SQL; frozen historical recovery reference, never replay blindly.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/production-attempt-a01-profile-closure-operator-result-20261101.json` — Unique later abandoned attempt cancellation before publication.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/production-private-profile-closure-operator-result-20261101.json` — Unique original attempt cancellation/closure result; no new prepare/closure follows.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/production-source-only-correction-operator-return-20261031.json` — Historical installed passive entry bundle identity and scoped readback; not the selected runtime.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/t4-installation-operator-return-20261030.json` — Historical installed passive environment bundle identity and nonactivation evidence.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/w1-cold-recovery-proof.json` — Unique cold recovery result retained without repeating acceptance.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/w1-qualification-result.json` — Unique accepted isolated W1 scope and artifact/dependency limitations; not production proof.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/w2-db-local-proof.json` — Concrete isolated DB migration/schema/ACL preservation evidence.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/w2-final-review.json` — Final W2 correction disposition; complements the detailed result.
- `codex/archive/production-20261101/files/codex/evidence/production-release-package-20261029/w2-qualification-result.json` — Unique final isolated W2 migration/ACL/recovery qualification and its limits.

## Standalone duplicates proposed for deletion only after approval

All five were verified by exact bytes or reconstruction from immutable published commits,
not similar names. Canonical published material remains; the manifest records offsets,
lengths/hash identities or the exact reconstruction source. Four references in old source/
preparation metadata remain frozen as capture-time references, not live file dependencies.
The following map explains those references after removal of redundant standalone copies.

- `codex/evidence/production-deployment-20261101/documentation-alignment/roadmap-approved-section.md` → `codex/IMPLEMENTATION_ROADMAP.md` (EXACT_PUBLISHED_DOCUMENT_BLOCK).
- `codex/evidence/production-deployment-20261101/notification-policy-origin-review/VPS-01-PRESERVE-FAST-FORWARD-BUILD.sh` → `codex/evidence/production-deployment-20261101/notification-policy-origin-review/PRODUCTION-DEPLOYMENT.md` (EXACT_PUBLISHED_DOCUMENT_BLOCK).
- `codex/evidence/production-deployment-20261101/notification-policy-origin-review/VPS-02-ACTIVATE-PRODUCTION-POLICY-START.sh` → `codex/evidence/production-deployment-20261101/notification-policy-origin-review/PRODUCTION-DEPLOYMENT.md` (EXACT_PUBLISHED_DOCUMENT_BLOCK).
- `codex/evidence/production-deployment-20261101/notification-policy-origin-review/VPS-RETURN-PREVIOUS-RELEASE-SETTINGS.sh` → `codex/evidence/production-deployment-20261101/notification-policy-origin-review/PRODUCTION-DEPLOYMENT.md` (EXACT_PUBLISHED_DOCUMENT_BLOCK).
- `codex/evidence/production-deployment-20261101/notification-policy-origin-review/source.diff` → `codex/archive/production-20261101/files/codex/evidence/production-deployment-20261101/notification-policy-origin-review/manifest.json` (EXACT_RECONSTRUCTED_PUBLISHED_DIFF).

## Local-only material and preservation

The full407-file B set is deliberately not published or declared content-safe. It includes
retired executable/proof history and unreviewed operator/configuration material; classification
B is conservative preservation, not a claim that every file contains a secret. Its original
relative paths are mirrored under the proposed private archive root recorded in the manifest.
No B contents/digests are included in the public review manifest. The full original mixed
roadmap and the legal draft remain D open work; H2 has REVIEW_REQUIRED because its single
large hunk mixes historical status with unresolved legal/retention work.

A move outside the repo is not backup. Before B source removal or C deletion, an operator
must establish a verified protected independent copy of the complete pre-cleanup set and
private byte/mode ledger. No such backup destination/receipt has been established by this
local-only review. Keep sources intact until it is. Do not substitute a second folder on the
same disk for an independent backup or expand this review into provider/VPS access.

Only the proposed exact roadmap H1/H4 cleanup and small current-runbook archive-reference
patch may alter tracked documentation after approval. H2/H3/legal bytes remain unchanged.
No .gitignore hiding, git clean, reset, stash or blanket add is part of this disposition.
