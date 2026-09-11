# Private Product document assets

Classification: bounded private PDF asset upload/download and lifecycle implementation.
Base: `916dbcdb20d7462f73063c1f246e7d1f8a4470c9`.

## Scope and authority

Reuses Document and its existing CHECK constraints. No schema/migration or
ProductDocument mutation. No Product, ProductVersion, Passport, QR, translation,
Public DPP or dashboard navigation change. There is no Document Library UI.
The reusable HTTP surface is intended for the next Product attachment slice.

Organization comes from the existing authenticated session/context. Every
persistence operation revalidates exact membership/user/Organization and active
statuses. Shared locks hold membership and Organization authority through each
short transaction. Upload and recovery require PRODUCT_EDIT (OWNER/ADMIN/EDITOR).
Download requires PRODUCT_READ (including VIEWER). This is tenant-owned, not yet
Product-bound. A Document ID alone never authorizes a request.

## Private HTTP surface

- POST `/api/documents`: raw `application/pdf` body, not multipart or JSON.
- `X-Document-Filename`: encodeURIComponent of the original metadata filename.
- Optional `X-Document-Display-Name`: encodeURIComponent of an asset display name.
- Existing canonical Origin and trusted proxy validation; authenticated context
  and PRODUCT_EDIT are checked before body consumption.
- Success: 201 `{status: "AVAILABLE", documentId}`. The ID is a private dashboard
  resource handle, not a public capability. No storage identity/checksum/actors.
- GET/HEAD `/api/documents/[documentId]`: active tenant context and PRODUCT_READ,
  owned AVAILABLE Document only; trusted proxy and absent or canonical Origin.
- No query parameters, anonymous route, recovery HTTP route, attach route or
  document listing is introduced. Next supplies unsupported-method behavior.

GET returns application/pdf with attachment disposition (safe ASCII fallback and
UTF-8 filename*), nosniff, private/no-store cache, and restrictive CSP. No provider
URL, response headers, ETag, error body or redirect is forwarded. HEAD uses the
same tenant/state authority, returns metadata without bytes, and does not fetch
the object. Like any HEAD, it is not a storage-health proof.

Range support is intentionally deferred: Range is ignored, authorized GET returns
200/full content with Accept-Ranges: none; HEAD remains bodyless. No partial or
multi-range transport is implemented. Downloads are bounded to 10 MiB and fully
checksum-verified before delivery rather than streaming unverified bytes. This
costs bounded memory and one full provider read per download. The HTTP runtime
allows at most four active file operations per process; edge rate/body limits
remain deployment prerequisites, not a distributed quota implementation.

Safe codes: VALIDATION_ERROR, FORBIDDEN, NOT_FOUND, NOT_AVAILABLE, UPLOAD_FAILED,
RECOVERY_REQUIRED, OPERATIONAL_FAILURE. Errors never include raw provider/Prisma
messages. No diagnostic payload or file content is logged by this slice. UI
localization belongs to the future UI, which will translate these stable codes.

## PDF validation

Exactly 10 * 1024 * 1024 bytes maximum; >0 bytes. Content-Length is an early
check only: chunked bodies are independently capped while read, with a 30-second
body deadline. File extension must end in .pdf (case insensitive), declared MIME
must equal application/pdf, and first five bytes must equal literal `%PDF-`.
This is not a PDF parser or malware verdict.

Strip both slash/backslash path components, normalize basename to NFC and trim;
limit to 200 Unicode code points. Reject NUL, CR/LF, C0/C1 controls and bidi
format controls before normalization. Optional displayName is trimmed/NFC, blank
becomes null and has a 200-character input limit. It is not a Product title.
Server SHA-256 is lowercase hex over exact bytes. Own a separate Uint8Array
before asynchronous work (Buffer.slice is not a copy). No thumbnail, extraction,
rewrite, parsing or rendering occurs.

## Storage port and Supabase adapter

Narrow port: generate storage identity, put a new private object, read a private
object. No deletion, update/upsert, signed URL, provider types or generic storage
framework. Supabase is isolated to an infrastructure REST adapter with injected
fetch for tests; no Supabase SDK dependency.

The key is `documents/<random UUID v4>.pdf`. No original filename, tenant UUID or
other user path input. Repeated identical files intentionally get new keys and
new Document rows; no checksum dedup or cross-tenant reuse.

Adapter checks the configured bucket exists and has `public: false` before each
object operation. No bucket creation or configuration mutation. POST object uses
`x-upsert: false`; existing keys cannot be overwritten. Reads use the authenticated
object endpoint. Only configured provider/bucket and generated key syntax are
accepted; redirects are errors. Provider requests have bounded deadlines;
response bodies are capped, including bucket metadata. Errors are sanitized.

After put, the service reads back bytes and verifies size and SHA-256 before
AVAILABLE. No assumption that ETag is SHA-256. GET also verifies against stored
checksum. This doubles upload transfer and adds read bandwidth intentionally.
A provider administrator changing a bucket to public or replacing objects is
outside app-level protections: deployment must restrict administrative access and
retain private bucket policy. The app must never grant anon/authenticated direct
storage access, issue signed links or treat opaque keys as authority.

## Runtime configuration (no env files modified)

New server-only keys, validated lazily when document runtime is composed:

- DOCUMENT_STORAGE_SUPABASE_URL: exact hosted project HTTPS origin,
  `https://<20 lowercase alphanumeric project-ref>.supabase.co`, no path/query.
- DOCUMENT_STORAGE_SUPABASE_KEY: server secret `sb_secret_...` (preferred) or
  legacy JWT with service_role claim. Not anon/publishable or a user JWT.
- DOCUMENT_STORAGE_BUCKET: `passvero-staging-documents` or
  `passvero-production-documents`, matching existing PASSVERO_RUNTIME_ENV.

Secret keys use apikey only; legacy service-role additionally uses Authorization.
JWT decoding here checks configuration shape, not user authentication or signature
validity; Supabase validates the credential. Credentials are read only in the
server-only composition module. No NEXT_PUBLIC key or fallback credential.
Missing/invalid configuration fails document requests safely; other routes/build
remain usable without document configuration. Custom/self-hosted endpoints are
not supported by this initial hosted-only configuration contract.

Staging/production projects and credentials should be isolated. Later operator
configuration must confirm private bucket, PDF MIME/10 MiB limits, no public RLS
read/write, immutable-key behavior and secret-safe logging. No live Supabase,
staging or production action is authorized by this source implementation.

## Lifecycle, audit and recovery

1. Authorize, receive bounded bytes and validate/hash.
2. Short transaction revalidates authority and creates PENDING_UPLOAD with real
   size/checksum and generated storage identity. No false placeholder metadata.
3. Upload and read-back verification occur outside any DB transaction.
4. Short finalization transaction revalidates membership, locks owned Document,
   changes PENDING_UPLOAD to AVAILABLE with uploadedAt, and inserts exactly one
   minimized DOCUMENT_UPLOADED audit atomically. No filename/key/checksum metadata.
5. Storage/verification failure attempts PENDING_UPLOAD -> FAILED with failedAt
   and safe STORAGE_FAILURE code; never emits a success audit.

AVAILABLE is immutable in this slice. Repeated finalization of AVAILABLE is a
no-op, including no timestamp/audit change; concurrent finalization serializes
on the Document lock. FAILED/ARCHIVED cannot be finalized. The persistence
finalizer is internal and called only after storage verification, not client input.

Crash/failure matrix:

| Boundary | Durable result | Handling |
| --- | --- | --- |
| Validation fails | No row/object | Safe validation rejection |
| Pending DB insert fails | No storage write | Operational failure |
| Crash after pending insert | PENDING_UPLOAD, possibly no object | Detect by state/age; reviewed recovery |
| Storage write fails/acknowledgement uncertain | FAILED, or PENDING if marking failed also fails | Never report success; retain evidence/object |
| Storage succeeds, finalization/audit fails | PENDING_UPLOAD and private object | RECOVERY_REQUIRED, no success audit |
| Finalization commits but response is lost | AVAILABLE and exactly one audit | Idempotent internal recovery/read verifies state |

`recoverPending(documentId, authenticatedContext)` is an internal application
contract, not automatic retry or a browser endpoint. It requires PRODUCT_EDIT,
rechecks tenant ownership, re-reads/verifies a pending object's bytes, then invokes
the same transactional finalizer. It never uploads, overwrites, attaches or
crosses tenant boundaries. Missing/unreadable/mismatched object remains pending
and returns RECOVERY_REQUIRED; no guess that an unavailable provider means absent
storage. FAILED recovery/re-upload and all cleanup are intentionally excluded.
An operator can identify aged PENDING_UPLOAD/FAILED records through a separately
authorized tenant-scoped diagnostic; no unrestricted recovery CLI is introduced.
The upload HTTP failure does not expose storage identity. Recovery lookup is a
reviewed support operation, not an automatic client retry.

Orphans are retained privately for later retention handling. No archive, hard
asset delete, physical cleanup, cleanup UI, outbox or hidden retry. Normal removal
of a future draft association must not delete these assets.

## Public and malware boundary

AVAILABLE means verified private upload completion, not malware-safe. There is
no anonymous delivery or ProductDocument creation here. Public DPP source/DTO
and publication behavior remain unchanged. PUBLIC_DPP_DOCUMENT_PRESENTATION is
blocked until an explicit malware-scan design/gate is approved. The existing
publication check for AVAILABLE alone must not be reused as public scan proof.

## Verification and next work

Focused validation, lifecycle, HTTP, fake Supabase and source boundary tests;
disposable PostgreSQL with all committed migrations for actual CHECKs, tenant
isolation, authority revocation, success/failure, concurrent finalization and
audit rollback. No live storage calls. Full application/infrastructure/schema
suites, TypeScript, ESLint, isolated safe-origin production build and both npm
audits are required. PostgreSQL cluster must be stopped/removed after proof.

Next: PRODUCT_DOCUMENT_VERSION_ATTACHMENT, then gated
PUBLIC_DPP_DOCUMENT_PRESENTATION. Manufacturer/GTIN/images/search/CSV remain out
of scope. No commit or staging deployment in this implementation phase.

Provider references checked during implementation:
- https://supabase.com/docs/guides/storage/uploads/standard-uploads
- https://supabase.com/docs/guides/storage/serving/downloads
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/changelog.md

Supabase recommends resumable uploads above 6 MB for reliability; standard upload
supports this bounded 10 MiB contract. Resumable sessions/retries are intentionally
not introduced. A timeout fails safely and retains lifecycle evidence.

## Source implementation verification result

- Focused document application/adapter tests: 32 passed.
- Document/ProductDocument schema tests: 18 passed within the full schema suite;
  three new boundary tests also pass.
- Disposable PostgreSQL 16: all 19 committed migrations applied; seven new
  document tests plus 48 existing Product/clone/publication/materials/translation
  integration tests passed (55 total). The cluster was stopped and removed.
- Application suite: 628 passed. Infrastructure suite: 238 passed.
- Schema/governance suite: 282 passed; adapter inventory explicitly extended.
- TypeScript and changed-file ESLint passed. Full ESLint: zero errors and 15
  pre-existing warnings outside changed files.
- Isolated production webpack build with .invalid origin passed. No .env or
  private runtime values were included; all 67 client JS chunks were checked
  for private document configuration references, with zero matches.
- npm audit: zero; npm audit --omit=dev: zero.
- Zod 4.6.2 is now a pinned direct validation dependency (previously transitive).
- No schema/migration/env file changes, commit, staging/production access or
  live storage operations. Actual Supabase private-bucket acceptance is pending
  the separately authorized staging configuration/acceptance phase.
