# Organization billing profile — implementation and staging acceptance

Source base: main / 917fb16144fe14aa370365f4bc997ff33920d40a; initial worktree and index clean.

## Contract and implementation

One optional OrganizationBillingProfile per existing Organization (organizationId primary key,
Restrict FK). No backfill. Existing organization displayName/general legalName/billingEmail,
EconomicOperator address book and published manufacturer snapshots remain unchanged. The new
private profile is authoritative only for this billing-details workflow; no automatic synchronization.
Country uses the existing uppercase alpha-2 countryCode convention with an assigned-code allowlist.
Postal/tax/VAT identifiers are text. Five required fields; strict bounded Zod input, no registry,
VIES, tax readiness or invoice issuance claims. Future invoices must own immutable billing snapshots.

BILLING_PROFILE_READ and BILLING_PROFILE_UPDATE are granted only to existing OWNER and ADMIN
roles through the trusted context. EDITOR/VIEWER receive neither. The server revalidates canonical
User, ACTIVE Membership and ACTIVE Organization inside each serializable transaction. User has
no separate active-status column; existing authentication eligibility remains with the trusted
resolver. No organization ID is accepted in the command. PostgreSQL serializable isolation and
expectedRevision CAS prevent lost writes; unique primary key handles simultaneous initial creation.
No automatic transaction/write retry. Unchanged normalized data returns NO_CHANGE with no audit
or revision bump. Stale revisions are rejected before no-op evaluation.

Profile and AuditLog insert are atomic. Audit metadata contains only revision, plus existing
actor/organization/correlation identifiers. No addresses, emails or tax IDs in audit metadata or
error output. Billing routes use canonical origin/trusted proxy, strict 8192-byte JSON and a 10s
read deadline; private no-store responses. Public DPP and product CSV contracts are unchanged.

/dashboard/billing is a dedicated authorized sidebar destination, not a Settings placeholder.
Six languages, native country select, autocomplete, required/optional labels, preserved input on
conflict, explicit review of latest saved values before choosing its revision for the next save.
No automatic email is sent. A missing profile does not gate product work or publication.

## Local evidence

- Billing validation/role and HTTP boundary tests PASS.
- Existing dashboard/public DPP regression batch: 38 tests PASS.
- Existing context resolver/public-DPP boundary tests passed; billing presentation test assertion
  was corrected for React's autoComplete serialization. Six-locale form rendering PASS.
- Disposable PostgreSQL: tenant read/write, revoked role/inactive membership/organization,
  create race, uniqueness, revision CAS, no-op, leading zeros and audit failure rollback PASS.
  Runtime ACL reproduction PASS with SELECT-only existing User/Organization/Membership,
  SELECT/INSERT/UPDATE new profile and existing SELECT/INSERT AuditLog. No existing
  Organization UPDATE is needed.
- Schema identity regression: 3 PASS. Public DPP canary privacy regression: PASS.
- Prisma schema validation and unchanged previous migration hashes: PASS.
- TypeScript: PASS. Build: PASS, RFvdGbe0Q7-bWijN47Fzk.
- Full lint initially found one JSX-inside-try error in the new page; corrected and
  affected lint passed. Scoped lint subsequently found the React.createElement
  provider children-prop/type incompatibility in the new test; a narrow documented
  lint exception resolves that test-only issue. All affected lint checks pass.
  The full scan retains 15 unrelated pre-existing Better Auth proof warnings.
- Whitespace: PASS. No scanner/PDF/CSV acceptance repeated.

## Staging procedure and retention

Original handoff (completed): staging migration and initial deployment are now PASS.
The verified package is /home/darko/passvero-billing-917fb16 (copy to /tmp for execution).
27 source/schema/test files; source-review SHA-256:
`a733dac640db82561981c6a03e036ee24b830524f76c55120a3b861c68bf6f0c`.
1145 application/message artifacts; build `RFvdGbe0Q7-bWijN47Fzk`.
Checksum-file SHA-256:
`c8de5b9b1990aac81af44b5e0e4faed38c214f0e17995328756d778a4fcc1d43`.
Only a test lint comment changed after successful build; executable inputs are unchanged.
Documentation is separate from the executed artifact. The adjacent current manifest
is finalized with operator results and UI acceptance below.

Confirmed backup: /var/lib/passvero-billing-917fb16/migration/staging-before.dump.
Confirmed initial application rollback: /var/lib/passvero-billing-917fb16/application/rollback.py.
The operator confirmed these live artifacts. Both scripts reject blind repeat execution;
the deploy requires a successful exact migration report before changing the app.
Migration: 20260924120000_organization_billing_profile; additive table only. Previous application
release kiXCpv3nqiz1u_K4f8Pbv ignores the table and remains compatible. Before migration, verify
exact migration history/target database and back up staging; apply once through Prisma migrate
deploy. Grant SELECT/INSERT/UPDATE only on the new table to the existing runtime role.
No changes to existing table ownership/ACL, scanner/producer, secrets or startup configuration.
Application rollback retains the new table, profile and audit; no automatic database restore/drop.

Staging create/reload/update/reload PASS in Passvero Acceptance using synthetic
profile SINTETIČKI BILLING TEST 20260924, Testna ulica 1, Testno mjesto, HR, postal
00100, tax identifier 000123 and billing-acceptance@example.invalid. Second save
added SINTETIČKI ACCEPTANCE — izmjena 2 to addressLine2. Both reloads retained
values and leading zeros; organization displayName remained unchanged. No email delivery. The synthetic profile and audit may remain as explicitly
authorized acceptance evidence; retention duration is an open decision before production.

Explicit historical operator recovery remains accepted evidence; reboot acceptance, automatic
post-reboot recovery and long-term unattended continuity remain NOT_PROVEN. Unrelated earlier
NOT_PROVEN/PDF findings are not rerun or changed. No invoice/subscription/Stripe/Platform Admin.
No commit or push.

## Operator result and bounded UI correction

[Sanitized operator result](evidence/billing-profile/operator-deployment.json):
migration PASS once, empty new table, existing identity/audit/ACL unchanged,
Prisma up to date. Backup SHA-256:
`c361ccd3fb7c9c047d3b0b32d29803e528f022b04117191c448fb14f9dcdc2c5`.
Initial deploy RFvdGbe0Q7-bWijN47Fzk PASS, 1145 artifact files, HTTPS/TLS 200/0,
startup errors 0, runtime/scanner/broker/producer unchanged. No production changes.

The live form exposed two presentation defects: a nonexistent sidebar icon name
and Serbian country names using Cyrillic via the default Intl locale. Corrected to
an existing document icon with compile-time icon validation, and sr-Latn region
labels. A focused Serbian Latin regression failed before the correction and passed
after it; 9 affected UI/regression tests PASS, TypeScript and affected lint PASS.
A new build is required only for these changed UI inputs. No migration, database
proof or repeat of accepted create/update data writes is required.
Final six-language/mobile visual acceptance and screenshots are PASS after the UI
correction deploy. The synthetic profile/audit are retained; no cleanup requested.

UI correction package: /home/darko/passvero-billing-ui-fix-917fb16.
Accepted final build: `kdteiRQIs5u_ZgM79J0WX`.
Source-review SHA-256: `8c2cfd66cd9a5e39f2c1e40b86987847630768be09340c817f842461ea1cd85a`.
Checksum-file SHA-256: `712264bcb8e862e430fa4705e050cd66c651d20753ccf592836e9c53c58bfc03`.
Accepted UI-only deploy saved RFvdGbe0Q7-bWijN47Fzk at
/var/lib/passvero-billing-ui-fix-917fb16/application/rollback.py.
The initial pre-billing rollback and database backup remain retained separately.

## Final staging acceptance

[UI correction operator evidence](evidence/billing-profile/ui-correction-deployment.json)
confirms build `kdteiRQIs5u_ZgM79J0WX`, 1145 verified files, HTTPS/TLS 200/0,
zero startup errors. Runtime and scanner/broker/producer configuration unchanged.
The 27 source/schema/test files match the accepted correction source-review hashes.
Final documentation and screenshots are subsequent evidence, not rebuilt executable inputs.

Browser acceptance: PASS. The existing authorized Passvero Acceptance session opened
all six billing routes (hr, en, de, sl, sr, pl), with translated field labels and
country names. Serbian country is now Latin `Hrvatska (HR)`; billing sidebar icon
renders. The retained synthetic profile and leading zeros are unchanged after deployment.
Create/reload/update/reload evidence from the initial billing build is reused because
persistence inputs are unchanged; no additional save was performed for the UI correction.
Desktop layout, label wrapping, Tab traversal to address/country/save and visible save
focus were observed. Mobile form, bottom/save area and billing menu navigation passed
at 390 x 683 CSS pixels using Chrome responsive emulation, not a physical device.
No horizontal overflow was observed. Mobile was checked in Croatian; six locales were
visually checked on desktop. Authorization/concurrency/atomicity rely on the local
PostgreSQL proof, not additional staging identities or concurrent live writes.

Screenshots are cropped to application content; only synthetic billing values and the
acceptance organization are shown. Browser bookmarks/profile and DevTools are excluded.

- [Desktop form](evidence/billing-profile/desktop-hr.png)
- [Keyboard focus](evidence/billing-profile/desktop-focus.png)
- [Serbian Latin](evidence/billing-profile/desktop-sr.png)
- [English](evidence/billing-profile/desktop-en.png), [German](evidence/billing-profile/desktop-de.png), [Slovenian](evidence/billing-profile/desktop-sl.png), [Polish](evidence/billing-profile/desktop-pl.png)
- [Mobile form](evidence/billing-profile/mobile-top.png), [mobile save area](evidence/billing-profile/mobile-bottom.png), [mobile menu](evidence/billing-profile/mobile-menu.png)

Billing profile implementation and limited staging acceptance: PASS. This is not a
payment/invoice system or legal/tax registry verification. Synthetic profile and audit
are retained; retention duration remains open before production. Earlier unrelated
NOT_PROVEN statuses and PDF findings are unchanged; reboot acceptance NOT_PROVEN.
No commit/push. The adjacent SHA-256 manifest is the exact final changed-file inventory
(excluding its own recursive hash); documentation/evidence are separate from the 27
executed source/schema/test inputs. No temporary deploy packages or credentials included.

## Requested receipt icon refinement — staging PASS

After the accepted billing UI, the user requested only a distinct sidebar icon.
The billing navigation now uses `receipt`; the shared SVG registry adds that one
icon. DPP retains `document`. No behavior, translations, persistence or permissions
changed. TypeScript, affected ESLint, whitespace and staging webpack build PASS.
Build preparation initially needed network access for existing fonts and the public
BETTER_AUTH_URL staging origin; no source/configuration workaround was introduced.

Deployed final build: `OD9e4NOtu9LlMjE_0U2Dz`.
28 source/schema/test files (the prior 27 plus the SVG registry); only the navigation
icon reference and new SVG entry differ from accepted executable source.
Source review SHA-256: `f1bb06d28e46c180c566b9c1600d92381d276951bed2d1dfca803cef7d67a2b6`.
Package: `/home/darko/passvero-billing-icon-917fb16`.
Checksum-file SHA-256: `991daa9545791a2daac5862d4710b79a9fb4c7b22f9182353f79567c1b9eb538`.
Deploy requires current build `kdteiRQIs5u_ZgM79J0WX` and saves its rollback at
`/var/lib/passvero-billing-icon-917fb16/application/rollback.py` before replacement.
Operator confirmed the saved rollback. Earlier rollback paths remain retained.

Status: deployment PASS, icon visual check PASS. Prior billing acceptance remains valid; screenshots
above show the earlier document icon and are historical evidence, not proof of the
receipt icon deployment. No unchanged functional tests, migration or acceptance were
repeated. No commit/push; no scanner/producer/runtime configuration changes.


[Icon deployment result](evidence/billing-profile/icon-deployment.json): operator
confirmed 1145 files, HTTPS/TLS 200/0 and zero startup errors. A browser refresh
confirmed the receipt icon next to billing, distinct from the unchanged DPP icon.
[Final screenshot](evidence/billing-profile/desktop-receipt-final.png) is cropped to
application content and contains only synthetic acceptance data. No profile save
was performed. The deploy script's NOT_YET_RUN field refers to a new full billing
acceptance run; unchanged prior functional acceptance is reused, not repeated.
Final source pins: 28/28; final documentation/evidence are separate from the artifact.
