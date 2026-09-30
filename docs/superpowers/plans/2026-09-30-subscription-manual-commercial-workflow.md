# Manual commercial subscription workflow implementation plan

> Execution: superpowers:subagent-driven-development, with source work continuing under the user's explicit implementation authorization. Final reviewed commit subsequently authorized; no push. Existing documentation diff is preserved in this workspace.

**Goal:** OWNER request → external offer recorded → OWNER acceptance → billing operator simulated-payment confirmation → initial activation or same-plan renewal on staging.
**Spec:** `codex/SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md`, §§3–4 confirmed with the user's downgrade/live-identity refinements.
**Architecture:** Existing Plan and Subscription remain catalog/current projection. Add immutable offer and paid-period records, mutable request lifecycle, explicit separate billing grant. Future paid periods preserve current rights; reads derive the effective period without requiring a cron job. All commercial writes reauthorize, lock organization/request consistently, and audit transactionally.
**Stack:** Existing Next/React/Prisma/PostgreSQL/Zod/next-intl; no added production dependency.

## Constraints and review focus

- Source, additive migration and staging deploy authorized; privileged execution by user only.
- Concrete live identities, synthetic organization change and date require user confirmation.
- No automatic grant from PlatformGrant, no Stripe/invoice generator, no production.
- No global quota enforcement, reminders, file/public expiry or destructive retention.
- Trial-existing organization dates are not inferred. First slice never starts trial automatically.
- Review renewal at exact expiry, repeated confirmation after expiry, offer revision replacement, missing billing profile, forged tenant/operator context and future-period visibility.

## Tasks

- [x] 1. Calendar/catalog: pure calendar periods with Zagreb DST/clamp/anchor rules and tests; fixed standard prices and explicit Custom limits. Owner: primary agent, `src/application/subscriptions/calendar.ts`, `catalog.ts` and matching application tests.
- [x] 2. Commercial persistence/service: additive schema/migration, DTO/contracts, state machine, authorization, offer snapshots, activation/renewal idempotency, separate billing grants and transactional audit. Owner: backend worker, `prisma/`, `src/application/subscriptions/` except calendar/catalog, `src/infrastructure/subscriptions/`, matching integration/application tests. Publish UI interface before UI work.
- [x] 3. UI/transport: six-locale customer/admin surfaces, safe HTTP boundary, read-only action visibility, existing shell/icons/mobile, login CTA. Owner: UI worker, routes/components/messages/navigation and HTTP/runtime wiring coordinated with backend. Relevant UI tests.
- [x] 4. Verification and delivery: focused disposable PostgreSQL proof, UI tests, TypeScript/lint/build/whitespace, independent review, manifest/rollback/roadmap and exact staging operator package. Owner: primary agent. No unapproved live identity mutation.

## Interface and dependency scan

| Tasks | Shared boundary | Ruling |
| --- | --- | --- |
| 1 / 2 | calendar and catalog exports | Pure functions; backend uses agreed exports, does not edit owned files. |
| 2 / 3 | service DTO and method signatures | Backend publishes contracts first; UI consumes them, no duplicate business rules. |
| 2 / 4 | schema and integration proof | Only backend changes schema; primary runs local disposable proof after generation. |
| 3 / 4 | routes/build | UI owns source until completion; primary integration fixes coordinated. |
| 1 | calendar contract vs tests | Include end-of-month, leap year, spring gap, fall overlap, exact end and anchor preservation. |
| 2 | scope vs implementation | Initial/same-plan only; immutable offer, audit rollback and renewal concurrency tests required. |
| 3 | display vs enforcement | UI explicitly says quotas are not yet globally enforced and counts occupied publication slots. |
| 4 | staging vs authorization | Package reviewable before privileged commands; wait for explicit identity/date confirmation. |

Delivery evidence and remaining visual/live-renewal limits are recorded in `codex/SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING.md`. Initial staging commercial acceptance and bounded HR/DE mobile browser-emulation review are PASS. Final reviewed commit authorized; no production or push. Unchanged tests/build/deploy are not repeated.
