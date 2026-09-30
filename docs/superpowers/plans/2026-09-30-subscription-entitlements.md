# Subscription entitlements, quotas and plan changes

Base: e024dd88894bf2d594f5e3921b84bd12058a519f; HEAD and remote main verified.
User explicitly authorizes source, additive migrations, local disposable proof and
controlled staging demonstration. No commit/push, production, actual payments,
email, deletion or scanner changes. Concrete staging transition/grants and product
classifications require one exact-ID proposal and approval before execution.

## Design

One resolver uses immutable paid receipts and the existing Subscription projection.
A once-only trial lifecycle records activation and cumulative product creation.
Organization-scoped transaction locks serialize quota consumption and commercial
changes. Existing Document PENDING_UPLOAD and ProductImageAsset PENDING rows reserve
storage before I/O; all retained rows count, including uncertain failures/orphans.
No reference count discount or deletion-based release. Finalization rechecks expiry.
Separate regulatory grant authorizes audited product-level classification; default
UNRESOLVED. Public HTML/image/PDF commercial gates remain additional to existing
publication/integrity/malware gates, without cache grace beyond entitlement limits.

## Global constraints

Trial 6 Zagreb calendar months, 3 lifetime creations, 3 occupied published slots,
3 stored products, 100 MiB and 5 PDF/version. Paid limits and 3/12-month prices are
unchanged. Null Custom limits are invalid. Rights use [start,end), UTC persistence.
Read/export/billing remain available after expiry with existing authorization.
Downgrade paid but over quota at start: BLOCKED_REQUIRES_OPERATOR, old rights end,
no new rights/grace, no automatic refund/credit/reschedule. Immutable financial
records; explicit audited supplemental/replacement agreement for resolution.
Regulatory grant is independent of billing/platform authority, with reason,
actor and previous/new classification audited; applies across product versions.

### Task 1: Commercial plan changes

Implement upgrade and downgrade through the existing commercial request/offer/
accept/payment UI and persistence. Upgrade explicit supplement price, activates
immediately after payment, keeps current period end; no implicit prorata. Future
renewal receipts must remain valid. Downgrade for next period; show exceeded
limits and consequences before acceptance; revalidate at activation, mark blocked
persistently and do not auto-unblock or extend rights. Safe replay/concurrency and
audit atomicity. Use immutable supplemental receipt model for upgrades rather than
mutating SubscriptionPaidPeriod. No replacement of historical snapshots. Existing
snapshot v1 parsing remains backward compatible. New commercial data lives in the
existing subscription domain. Own commercial contracts/service/prisma-commercial,
commercial-overview + six Subscription translation namespaces, additive migration
for commercial changes and corresponding schema blocks/tests. Coordinate shared
entitlement resolver integration with primary agent. No subagents, no commit.

### Task 2: Entitlement lifecycle and mutations

Primary agent: schema/lifecycle, shared resolver, mutation-path inventory, quota
locks and all create/edit/publish/asset attachment paths, activation hook, CSV
outcomes and replay. Preserve finalization/cleanup security work after expiry.

### Task 3: Public/regulatory and staging transition

Primary agent: separate regulatory authority, product classification history,
public HTML/asset gates and caching, exact-ID read-only inventory/operator tools,
transition proposal with finite exception periods. No live mutation before approval.

### Task 4: Review and verification

Focused tests and disposable PostgreSQL concurrency/atomicity/public/expiry proof,
TypeScript, lint, build, whitespace, mobile/six-locale checks and bounded synthetic
staging acceptance. Independent scoped review, final report/manifest/roadmap.
Track local versus live evidence, data retained and unexecuted rollback honestly.
