# Subscription reminders implementation plan

> Execution: inline using superpowers:executing-plans; final independent review.

**Goal:** Durable, truthful subscription/public-expiry reminders with bounded staging delivery and billing-only visibility.
**Architecture:** Reuse the existing entitlement coverage/resolver, public gate, Zagreb calendar, SMTP configuration and billing authorization. Add a durable outbox, explicit recipient confirmations and a bounded campaign/worker state. SMTP acceptance is distinct from inbox receipt.
**Spec:** User task SUBSCRIPTION_REMINDERS_AND_DELIVERY_STAGING_ACCEPTANCE and codex/SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md.

## Constraints and decisions

- Base HEAD and local origin/main 1fc84aa8ccc3118f8158029e8edf99275c8f7f6e; clean index/worktree verified.
- No commit/push, production, real payment, deletion, backup/restore, secrets or environment-file edits.
- Source/local proof approved. Actual send requires exact organization/address/operator/message-count approval. VPS commands are operator-only.
- Missed-window rule and manual billing-address verification explicitly approved together with exact capped staging proposal. Operator commands remain required for execution.
- Unique logical message: organization + authoritative deadline revision + kind/threshold + EMAIL + normalized address. Recipient role is deliberately not part of uniqueness.
- Recompute eligibility immediately before send. Renewal suppresses obsolete lock warnings; pending downgrade explicitly remains conditional. Public warnings only for live VOLUNTARY publications, using existing publicAvailability.
- SMTP has no exactly-once/idempotency promise. Persist SENDING before transport; abandoned SENDING becomes DELIVERY_UNKNOWN. Only proved pre-acceptance transient errors retry, three total attempts, 5 then 30 minutes. Explicit evidence-based resolution never blindly retries unknown delivery.
- Campaign is fail-closed, staging-only, expires, allowlists organizations/addresses/operator emails and has an atomic global dispatch budget. Manual and scheduled executions share it. Maximum 25 organizations, 32 addresses, 10 sends/cycle; five-minute systemd timer, five-minute lease, bounded SMTP timeout.
- Private billing confirmation binds exact profile revision/address; operators must independently verify possession and record a non-secret evidence reference. User preference locale, organization locale, then Croatian fallback.

## Tasks

- [x] 1. Tests first: Zagreb thresholds/DST/exact expiry, authoritative coverage, future renewal, blocked downgrade, public classification and all six template locales. Add signed calendar-day helper via existing resolver; no independent date arithmetic.
- [x] 2. Add additive schema/constraints: ReminderCampaign, SubscriptionReminder, ReminderAttempt, BillingEmailConfirmation. Implement fresh verified OWNER/operator resolution and address deduplication.
- [x] 3. Implement enqueue/claim/revalidate/send/finalize/recover with leases, fencing, bounded retry and audit. Disposable PostgreSQL proof includes overlapping workers, restart, budget, recipient revocation and renewal.
- [x] 4. Add billing-authorized overview and explicit confirm/resolve actions, protected HTTP/server flow, localized display. No tenant exposure of operator recipients.
- [x] 5. Prepare staging artifacts/proposal/runbook/rollback; approved delivery and real timer demonstration confirmed. Preserve other NOT_PROVEN boundaries.
- [x] 6. Run focused suites, TypeScript, lint, production build, whitespace; independent review and affected rechecks. Update report/roadmap/manifest and leave reviewed diff.

## Review focus

Concurrent budget exhaustion; expired lease while SMTP is in flight; profile changes back to an old address; downgrade not yet eligible at future start; period already expired when worker first starts. Tests must show no duplicate transport, fail-closed recipients and honest conditional language.

## Execution ledger

- Initial discovery: no billing-address confirmation; SMTP via nodemailer; existing runtime uses separate application/auth clients. Existing VPS uses systemd scheduling and PM2 application. Prior live identifiers are historical until fresh operator preflight.

- Source/local checkpoint: 14 disposable PostgreSQL, 18 focused application, 5 affected entitlement, 10 schema PASS. Independent reviewer findings fixed and re-reviewed. Read-only staging preflight PASS; migration/deploy output and sending/business-policy approval remain pending. No commit or push.

- Operator package checkpoint: pinned app/migration/worker package prepared from matching live preflight. Six isolated rollback simulations PASS; bounded package re-review clear. No live mutations or sending approval. Complete handoff in staging runbook.

- Live checkpoint: user returned migration/deploy PASS, timer disabled/campaigns0/email0, and explicitly approved exact delivery proposal plus both rules. Acceptance fixture sequence disposable PASS and cleanup3 PASS; reviewed public fixture/closure blockers fixed. Operator demonstration pending, inbox remains NOT_PROVEN.

- Diagnosed operator failure: read-only probe proves missing staging supplementary group for postgres child imports, all fixture/campaign/outbox/attempt counts0. Fix preserves UID/primary groups and adds only staging supplementary group; regression RED to GREEN,7 Python tests PASS. Guarded continuation uses new v2 directories and verifies prior failed evidence plus empty state. Fixture bundle and approval byte-identical. No approval extension or live email yet.

- Worker directory repair confirmed by operator: libraries and disabled enqueue PASS, campaigns2/enabled0/dispatches0/outbox0/attempts0/SMTP0. V3 resumes exact retained fixtures after validating v2 evidence and pristine delivery state; no budget reset. Dedicated disposable resume proof PASS,31 migrations, mock transport only; Python7, TypeScript, scoped lint and package integrity PASS. Pending v3 operator execution under unchanged approval.

- V3 operator output: SMTP accepted4, replay0, renewal cancelled2; user confirms two receipts per approved address. STOP ValueError at timer boundary; closure disabled/inactive, campaigns disabled, no service start, errors[]. Four-dispatch budget consumed. Current bounded step is read-only raw timer property and saved/live evidence diagnostic; no rerun or new dispatch.

- Timer diagnostic returned numeric0 and preserved all four accepted attempts; historical ValueError input remains unknown. Fixed independently verified systemctl timespan parsing defect. Scheduler-only pinned tool keeps campaigns disabled, observes actual timer/IDLE journal/service success, compares full reminder DB state and closes timer. Isolated scheduler6 + operator9 + directory1 PASS. Await operator output; no application rebuild or repeat email acceptance.

- Final operator evidence: PASS_TIMER_TRIGGERED_IDLE_CYCLE, service success/exit0, invocation8f41d476624547248dd60efc650cc285, full reminder DB unchanged, additional dispatches0. Timer disabled/inactive, campaigns remain disabled/exhausted. All five approved demonstration steps complete across retained evidence. No pending command; leave source/diff/manifest for commit decision. Live browser visual review and prior unrelated NOT_PROVEN boundaries retained.

- Final UI/commit checkpoint 2026-10-01: authorized Chrome desktop and responsive 320/375/390/768/1024/1440 review PASS; navigation, statuses and expected fixture records verified. Tenant billing showed only current organization. No UI correction or delivery mutation; existing tests and email acceptance reused. Independent review has no unresolved IMPORTANT/CRITICAL findings. User authorizes exact manifest-reviewed commit `feat(subscriptions): add reminders and delivery tracking`; no push. Earlier pending checkpoints above are historical.
