# Create draft from published Product

This slice adds a private draft from the validated current published version.
It does not change publication, anonymous Public DPP, or QR lifecycle rules.

## Authority and concurrency

- Permission: `PRODUCT_EDIT`, revalidated against active membership and Organization
  inside the transaction.
- The client submits Product ID, expected current published version ID, and the
  expected Product timestamp. No Organization, actor, version number, or copy data
  is accepted from the client.
- The tenant-scoped Product is locked using the same row lock as publication.
- Only ACTIVE Products with a valid owned PUBLISHED pointer are eligible.
- A compatible existing draft with the same clone provenance returns
  `EXISTING_DRAFT` without writes or audit, even if creation changed the Product
  timestamp. Unrelated/stale state returns `CONFLICT`.
- A new draft returns `CREATED_NEW_DRAFT`. The partial unique active-draft index
  and conditional pointer update remain authoritative. No automatic retry.

## Copy contract

- New ProductVersion: DRAFT, same source locale, `clonedFromVersionId` set to the
  current published version, fresh creator/updater and timestamps.
- `versionNumber` stays null. The existing publication service assigns the next
  Product-scoped number transactionally. Version label, change summary, review,
  publication, supersession, and discard metadata are not inherited.
- All ProductTranslation rows and their authoring fields are copied with new IDs.
- All ProductMaterial fields, including supplier and notes, are copied with new
  IDs. Source createdAt/id ordering is preserved using fresh monotonically
  increasing creation timestamps; no new ordering model is introduced.
- All ProductIdentifier authoring data is preserved with new IDs, including CN
  year and existing other identifier types. This does not introduce identifier
  write UI or barcode functionality.
- ProductDocument association fields are copied with new IDs while retaining the
  same Document asset IDs. Document tenant equality is checked before any write.
- Product identity, publicCode, Passport, QR, and published children are unchanged.
- Version creation, all child copies, pointer assignment, and one PRODUCT_UPDATED
  audit commit together. Audit metadata contains only the operation discriminator
  CREATE_DRAFT_FROM_PUBLISHED; child content and storage metadata are excluded.

## Image asset/version cloning

ProductImage is now a version-owned association to an immutable ProductImageAsset.
New drafts copy every association and its presentation metadata atomically; storage
objects are not copied, moved or overwritten. Replacement/removal edits only the
current draft association. Historical links and bytes remain unchanged. Foreign
asset ownership or non-ready/non-legacy references abort the entire clone.
Existing legacy rows remain retained and clonable; they are not silently certified
as normalized or exposed through the new image transport. See
`PRODUCT_IMAGE_UPLOAD_VERSIONING_AND_PUBLIC_DPP_STAGING.md` for migration,
normalization, delivery and cleanup rules. The temporary image-count rejection
is removed only together with this reference model and integration proof.

## UI and republication

Authorized published-only Products show Edit product. Success reloads Product
Detail to show the published snapshot and private draft separately. Existing
basic/content/CN/material editing is reused; the basic edit link is labelled
Continue editing when a published version also exists. Viewers have no mutation
control.

Existing publication evidence and confirmation remain mandatory. Republication
supersedes the previous version, publishes the draft with the next number,
switches the published pointer, and clears the draft pointer. Passport identity
is retained and its lastPublishedAt changes under the existing publication
contract. QR identity/status/target and Product publicCode remain unchanged.
Public DPP continues serving the old published version until that transaction
commits.

Image staging acceptance (2026-09-20, build `uXHDuXfdNBCLINFdIWQ0m`): a new
draft inherited A through a separate image association; replacing it with B left
public V1/A unchanged. V2 publishes B on the same DPP identity. Operator read-only
verification confirmed historical V1/A and current V2/B references and bytes.
See `PRODUCT_IMAGE_UPLOAD_VERSIONING_AND_PUBLIC_DPP_STAGING.md` for evidence.
