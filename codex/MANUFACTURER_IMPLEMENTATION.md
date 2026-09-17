# Manufacturer — bounded implementation and evidence

Source base: `880b34501b96830c8d94df601d654949a0512842` plus uncommitted diff.

## Contract

Only MANUFACTURER, represented by ProductVersionManufacturer. EconomicOperator
is tenant-local reusable directory data, independent of Organization/billing.
Required: name, addressLine1, city, uppercase two-letter countryCode. Optional:
addressLine2, region, postalCode, publicEmail and http(s) website without URL
credentials. No automatic translation or name deduplication; no hard-delete API.

CREATE and UPDATE are explicit directory operations in the product editor, also
available when that product has no current draft. They consume the product CAS
and audit the initiating product plus operator ID, without updating snapshots.
APPLY copies the selected, displayed operator revision into the editable draft;
both operator updatedAt and product/draft CAS must match. REMOVE clears only the
draft. Every mutation revalidates PRODUCT_EDIT, active membership/organization
through the existing locked authorization utility and trusted session resolver.
The existing User has no separate status column; its Membership FK and normal
session resolver retain existing eligibility semantics. Read requires PRODUCT_READ.
Publication retains PRODUCT_PUBLISH. There is no scheduler or admin bypass.

Snapshot fields are version-owned. New draft copies the old snapshot/reference;
refresh requires APPLY. Public DPP selects only snapshot fields, never current
EconomicOperator, IDs, audit fields or billing data. Missing manufacturer does
not block publication. Product row locking serializes editor mutations against
publication/CAS. No change to publicCode/Passport/QR identity.

## Migration and grants

`20260917120000_add_manufacturer_snapshot` adds two empty tables plus indexes and
restrictive composite tenant foreign keys; no existing rows/backfill/enum change.
Staging migrator must own the tables. Runtime needs SELECT/INSERT/UPDATE on
EconomicOperator and SELECT/INSERT/UPDATE/DELETE on ProductVersionManufacturer
(draft removal); no EconomicOperator DELETE grant is required. Existing Product,
ProductVersion, Membership, Organization and AuditLog grants are reused.
Never grant superuser or schema-owner privileges to the application.

Application rollback restores the prior release. Leave the additive schema and
any retained manufacturer/snapshot/audit records intact; no destructive down
migration after data entry. Migration and application replacement are separate
operator phases, with positive staging database identity and backups first.

## Local evidence

- 56 focused validation, public DTO/persistence/HTTP and clone unit regressions passed.
- TypeScript PASS, full lint 0 errors / 15 pre-existing warnings; changed-file lint PASS.
- Isolated secret-free staging webpack build PASS; first sandbox attempt failed
  fetching fonts, then succeeded with approved network access. No font substitution.
- Fresh local PostgreSQL cluster: additive migration on populated and empty DB;
  existing rows preserved; no backfill. 18 integration tests passed using a
  non-superuser test role, including manufacturer, clone and publish regression.
- Cross-tenant service/FK rejection, stale/concurrent CAS, revoked eligibility,
  transaction rollback, shared operator independence, historical snapshots,
  explicit refresh/republication and stable public identity passed locally.
- Six locale labels are provided; legal names/addresses remain entered values.
- Two pre-existing `tests/public-dpp-boundaries.test.mjs` assertions fail on clean
  base HEAD too (old public-source regex and old locale key count). No new claim
  that the entire legacy suite passes; those unrelated assertions are unchanged.

## Staging evidence

Completed on 2026-09-17 through the authenticated staging UI and anonymous Chrome.
Deployment: base `880b34501b96830c8d94df601d654949a0512842` plus reviewed
32-file diff; build `SG9637exSQVmIY3ePYVb2`, 638 artifact files verified.
Application/runtime code remains byte-identical to the deployment review;
only this evidence documentation and the roadmap changed after acceptance.

- Staging migration PASS, one deploy attempt, database `passvero_acceptance`,
  port 5433, data directory `/var/lib/postgresql/16/acceptance`. Three validated
  foreign keys; existing owners/grants/data preserved. Runtime grants as above.
- Authenticated UI: created manufacturer, explicitly applied Zagreb/10000 to
  draft, published v1. Anonymous Public DPP showed that snapshot.
- Updated reusable directory to Split/21000: anonymous v1 remained Zagreb/10000.
- Created new draft: inherited Zagreb/10000; explicitly applied Split/21000 and
  published v2. The same public URL anonymously showed v2 and Split/21000.
- Operator read-only SQL confirmed v1 SUPERSEDED retains Zagreb/10000; v2
  PUBLISHED retains Split/21000, cloned from v1, references the same operator,
  and is the current published pointer. No current draft. No SQL mutations.
- Cross-tenant/concurrency cases remain local integration evidence, not live tests.

Retained synthetic data (no cleanup requested):
- Product `f050e6a0-5c4d-4451-8c23-8fb87f459f56`, SKU `DPP-MFR-20260917-01`.
- Operator `45ea710a-262a-48e8-83f8-64eca9668dc2`.
- v1 `09c855d8-af2b-4a56-9ced-49e7cdd74af0`;
  v2 `b15c6a6d-85a5-4d22-b266-91f6cbf7910b`.
- Public URL `https://staging.passvero.eu/p/yBGW3UajBrPmzrTRaxJkRA`.
- Synthetic name/address, versions and audit retained. PVA-001 untouched.
  Public code stability was observed; QR activation/printing was not exercised.

Migration backup: `/var/lib/passvero-manufacturer-deploy-880b345/migration/staging-before.dump`.
Application rollback: `/var/lib/passvero-manufacturer-deploy-880b345/application/rollback.py`.
Rollback preserves additive schema and entered data. Staging HTTPS 200/TLS 0,
zero startup errors; runtime configuration and scanner/broker/producer unchanged
according to the operator deployment report. No production access or changes.

MANUFACTURER_SOURCE_IMPLEMENTATION=COMPLETE
MANUFACTURER_STAGING_UI=PASS
MANUFACTURER_PUBLIC_DPP=PASS
PUBLISHED_MANUFACTURER_SNAPSHOT_IMMUTABILITY=PASS
MANUFACTURER_CROSS_TENANT_PROTECTION_LOCAL=PASS
STAGING_MIGRATION=PASS
PRODUCTION_CHANGES=NONE

Production changes: NONE. Existing scanner/provenance, handoff isolation,
live recovery and unattended-operation NOT_PROVEN statuses are unchanged.
