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

## Temporary image limitation

A validated current published version containing any ProductImage row is rejected
with `CREATE_DRAFT_IMAGES_UNSUPPORTED` before any business write. This applies to
public and private images, regardless of upload status or count. The UI explains
that editing published products with images is not supported yet and that the
published product remains unchanged.

Images are never silently skipped, moved, assigned a reused storage identity, or
copied through object storage by this operation. This is a temporary lifecycle
limitation, not the final image architecture. A future Product image slice must
approve an explicit asset/version strategy before enabling this operation for
published versions containing images.

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
