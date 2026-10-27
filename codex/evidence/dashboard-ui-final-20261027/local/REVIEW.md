# CUSTOMER_DASHBOARD_FORMS_AND_WORKSPACE_UI_POLISH — local review

Scope: customer dashboard only. Main workspace #f5f4f0; white existing form/card surfaces; navy sidebar and teal actions retained. Dashboard-scoped controls use dark semibold labels, separate optional markers, #a8b3bf borders, 46px single-line controls (compact header 44px), teal focus, disabled/read-only/error styles and vertically resizable textareas. No new dependencies.

PDF uses the native accessible file input, a teal upload trigger, selected filename/status and existing hint. Choosing a file alone invokes no API. Save remains separate with existing metadata validation and pending guard.

Top and bottom publish placements share one context-owned handler, in-flight ref, pending/result state and original confirmation/evidence/client. Footer is outside other forms, only appears under the existing editable/publish slot conditions, and does not submit unsaved forms. Failure focus returns to the initiating placement.

CSV delimiter/actions stack on mobile; mapping and preview retain original rules and their own table scroll. Export reuses the existing secondary button and download icon. Billing keeps existing required fields, autofill, limits/privacy and country options with aligned two-column labels/controls. Subscription reuses existing cards and exact numeric usage/limits; progress values clamp visually while text preserves actual usage. An explicit PAID + staging-exception planSlug is shown as a localized staging exception, never a payment. No backend/model/API/auth/scanner/commercial logic changed.

Shared component review: customer CSS is confined to .customer-workspace. Platform review UI/editor constants are untouched; existing platform billing presentation tests passed. Shared LanguageSwitcher uses the same accepted flag/code visual, full native option names, accessible localized name and unchanged routing/query logic. Marketing branch output and public DPP source/assets remain unchanged. No new client data fetching introduced; server content remains server-rendered, with one small shared publication-state provider.

## Checks and exact scope

- Relevant ESLint PASS; TypeScript noEmit/incremental=false PASS. Final webpack build and its own TypeScript check PASS (see manifest for exact build ID/hash).
- Initial focused suite:70/72 PASS, two stale preexisting PDF-copy assertions expected text absent even from initial HEAD. Assertions were aligned to the existing unchanged privateNotice. Only that PDF test file was rerun:4/4 PASS. Thus72 distinct focused cases passed across the bounded run; no broad suite or DB integration tests.
- First build attempt stopped with ORIGIN_SCHEME because a process-only HTTP loopback origin was invalid. No environment files changed. Subsequent builds used the established HTTPS preview origin. Three intermediate successful builds preceded visual CSS fixes (specificity/progress, header alignment, inherited8px label margin); one final successful build covers the frozen source. These were corrective verification, exceeding the requested single build; no deploy/package is inferred from this local preview build.
- One60-view synthetic review:5 surfaces ×6 locales ×1440/375 widths. Correct labels, native selector/current language, no page overflow, billing alignment, controls/focus and staging-exception status checked. No real login/session/API/DB/Storage accessed.
- PDF native picker via keyboard selected synthetic-manual.pdf; filename updated with zero upload/save/scan calls. Both publish buttons disabled during one intercepted synthetic POST; extra click produced no second request; forbidden focus landed at bottom initiator. CSV mock headers/mapping/preview and invalid-row UI checked; confirm/execute were never called. No real business writes.
- Initial harness's final console assertion treated its deliberate mock403 as unexpected; recovered only interactions/classification, reusing the already completed60-view matrix. Expected mock403 is recorded, no unexplained app errors. A later test locator was narrowed from all product headers to the shell header. Final representative readback checks corrected CSS without a second locale matrix.
- Native progress teal, disabled/read-only/error styles and scope isolation verified. A full-page CSV screenshot had a fixed-element capture artifact; replaced with mapping/preview region screenshots. No source change was required for screenshot tooling.

Preview: http://127.0.0.1:3217 (synthetic component harness, not an authenticated application session). Browser plugin absent; existing Playwright/Chrome used. Components are actual project imports; navigation and Next image rendering are stubbed at the preview boundary, datasets are synthetic, compiled CSS comes from actual source/final build. Screenshot styling uses project/fallback fonts without a real authenticated root layout. No reference screenshots were attached in the task directory; implementation follows its detailed written specification and accepted palette.

Real authorized publication/upload/import/subscription writes and full authenticated routing are intentionally untested locally and require later user staging confirmation. User acceptance stays PENDING. No live environment was accessed and no commit/push/deploy/repin/service/recovery/backup/scanner acceptance occurred. Preexisting legal draft and roadmap bytes/HEAD/index are unchanged.

CUSTOMER_DASHBOARD_UI_LOCAL=COMPLETE
USER_VISUAL_REVIEW=PENDING
STAGING_DEPLOY_PERFORMED=NO
BUSINESS_RULES_CHANGED=NO
PRODUCTION_CHANGES=NONE
