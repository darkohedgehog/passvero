# Product Roadmap

## Phase 1 — Foundation

- project conventions;
- Codex documentation;
- next-intl setup;
- localized routing;
- localized metadata;
- language switcher;
- base design tokens;
- landing-page structure.

## Phase 2 — Marketing website

- desktop landing page;
- mobile landing page;
- localized navigation;
- product explanation;
- how-it-works section;
- industries;
- FAQ;
- pricing placeholder;
- contact/demo flow.

## Phase 3 — Authentication and organizations

- sign up;
- sign in;
- organization onboarding;
- owner role;
- protected dashboard;
- session-based organization access.

## Phase 4 — Product management

- product list;
- product creation;
- product editing;
- status workflow;
- search and filters;
- product images;
- organization ownership.

## Phase 5 — Product passport

- product versions;
- structured passport fields;
- public passport page;
- publication workflow;
- QR generation;
- localized public view.

## Phase 6 — Documents

- manuals;
- certificates;
- technical sheets;
- warranties;
- file validation;
- public/private document visibility.

## Phase 7 — Analytics

- scan event recording;
- product scan counts;
- coarse geographic analytics;
- privacy-aware storage;
- dashboard summaries.

## Phase 8 — Billing

Current scope: [commercial contract](SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md).
Delivery status: [central implementation roadmap](IMPLEMENTATION_ROADMAP.md).

- existing Plan/Subscription foundation, manual B2B bank transfer;
- 3/12-month package requests and explicit activation after payment verification;
- external Synesis invoice references, no Passvero invoice issuance;
- trial, product/storage limits and server-side expiry enforcement;
- customer/admin period visibility and reminders;
- proposed retention and staging-transition rules require confirmation.

Stripe, cards and payment webhooks are outside this scope.

## Phase 9 — Integrations

- CSV import;
- API access;
- WooCommerce;
- Shopify;
- ERP connectors;
- GS1-related interoperability.

Do not skip directly to later phases unless explicitly requested.

## Platform access and subscription UI alignment — 2026-10-06

UI source and focused local checks complete. Existing dashboard tokens, controls and
icons align access-request review and subscription/billing presentation. Business
handlers, authorization and persistence are unchanged; accepted functional evidence
is reused. Safari desktop/responsive review uses synthetic local data. Staging deploy PASS (`lE10F_R1mCOG9rWxeChAI`); authenticated Chrome desktop/mobile
read-only review completed without business actions. Rollback remains prepared; see
[UI alignment report](PLATFORM_ACCESS_AND_SUBSCRIPTION_UI_ALIGNMENT_STAGING.md).
No production, commit, push or automation changes.

## Staging notifications and reminders activation — 2026-10-07

Read-only inventory reviewed; automatic access notifications and reminder timer/campaigns
were initially disabled; the scoped proposal is approved and guard deployment PASS
(`qgd6USnbSbiUKZInR9gSC`). Operator configuration PASS: bounded ACCEPTANCE guard and exact campaign/timer enabled
at 2026-10-07T15:04:06.958Z. One automatic admin notification accepted and inbox-confirmed; request stays PENDING.
Finalization PASS: NEW_REQUESTS active with the original cutoff and no backfill.
Post-email regular cycle succeeded; subscription attempts remain zero. Historical test fixtures
are excluded. No eligible subscription message is due for the proposed controlled
onboarding tenant; its dates remain unchanged. The atomic one-attempt guard is deployed for the acceptance window;
NEW_REQUESTS retains the original cutoff after confirmed acceptance. See
[activation evidence](STAGING_ACCESS_NOTIFICATIONS_AND_SUBSCRIPTION_REMINDERS_ACTIVATION.md).

## Required next implementation: SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT

Status: REQUIRED_NEXT; not implemented in this notification automation commit.

Automatically enroll future eligible organizations in subscription reminders using their
existing trial/paid periods and confirmed authorized recipients. Preserve renewal
invalidation, idempotent enrollment/delivery, concurrency protection, bounded retry and
explicit sending controls; DELIVERY_UNKNOWN requires reconciliation. Define enrollment
scope, budgets and expiry without resetting periods or including historical/test backlog.
The currently approved staging campaign remains limited to its existing organization and
recipient; this roadmap item does not expand active campaigns or authorize new sending.


## SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT — 2026-10-08

Business policy confirmed; local implementation and focused PostgreSQL proof complete.
Controlled trial enrollment is atomic, scheduled reconciliation follows authoritative
paid periods, and managed sending preserves exclusions, recipient verification,
finite budgets and DELIVERY_UNKNOWN. Existing trial campaign limit 12 is retained;
new periods use 384 attempts / 32 deduplicated recipients and end+7 calendar days.
See [implementation and evidence](SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT.md).
Staging migration/deploy and fresh scope evidence: PENDING_OPERATOR_COMMAND.
Enable/new live identities/periods/recipients or sending require the exact combined
projection and user confirmation. No production change, commit or push.


- 2026-10-08 future reminder enrollment: corrected read-only operator preflight
  PASS (acceptance DB 5433, 32 migrations, 839 canonical artifacts); existing
  Milank campaign retains 12/0 and original deadline. Pinned additive migration
  and deploy/rollback package prepared; 6 local operator guard/rollback tests PASS.
  Staging migration/deploy PENDING_OPERATOR_COMMAND; enrollment enable and exact
  recipient/acceptance proposal remain separately unapproved. No SMTP execution.

- Returned 2026-10-08 enrollment migration/deploy PASS: build mMVPOjFPkw5L42RIqziS4,
  33 migrations/839 artifacts; policy disabled, enrollments 0, managed campaigns 0,
  Milank 12/0. Existing timer restored, installer SMTP 0. Combined enable/recipient
  and ordinary worker idle/replay projection prepared; awaiting user confirmation.

- 2026-10-08 user explicitly approved complete future reminder enrollment/recipient
  rule and future due delivery. Guarded one-shot enable plus two ordinary timer
  idle cycles PENDING_OPERATOR_COMMAND. Current Milank 12/0 retained; no extra
  live activation, identity/period, SMTP-forcing or commercial writes. Successful
  acceptance leaves policy/timer enabled. Four local operator guard tests PASS.

- **SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT — accepted staging scope,
  2026-10-08:** enable boundary 2026-10-08T15:22:24.818Z; one EXISTING_APPROVED
  enrollment, legacy current-trial campaign linked without duplicate 384-budget
  campaign; Milank unchanged 12/0. Two ordinary timer invocations COMPLETED with
  zero outbox/SMTP attempt delta, original exclusions (13) and counters retained.
  Policy/timer remain enabled. Future verified OWNER/confirmed billing recipient
  rule and due subscription delivery explicitly approved; operators empty and
  PUBLIC_AVAILABILITY disabled. New controlled activation proved locally, not
  performed live. Final evidence/manifest in codex/evidence/reminder-future-enrollment.
  No further acceptance action pending in this approved scope; no production,
  commercial writes, new live identity/period, commit/push or inbox claim.
