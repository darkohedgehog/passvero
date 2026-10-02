/** Private recovery harness: actual application read services with isolated read-only ports. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createExportCatalog } from "../../src/application/products/export-catalog/export-catalog";
import type { CatalogRecord, CatalogVersion } from "../../src/application/products/export-catalog/contracts";
import { createImageServices } from "../../src/application/products/images/service";
import type { ImageAsset } from "../../src/application/products/images/contracts";
import { readDocumentBytes } from "../../src/application/documents/bytes";
import { validatePdf, sha256 } from "../../src/application/documents/pdf";
import { permissionsForMembershipRole } from "../../src/application/permissions/product-permissions";
import type { AuthenticatedUserContext, MembershipRole } from "../../src/application/context/authenticated-user-context";

export interface RecoveryConfig {
  source: string;
  socket: string;
  database: "passvero_staging_recovery";
  objects: readonly { bucket: string; key: string; file: string; size: number; sha256: string }[];
}
type Query = <T>(sql: string) => T;
interface Ports { query: Query; readFile(file: string): Uint8Array }
interface ProductRow {
  id: string; organizationId: string; internalName: string; sku: string | null;
  lifecycleStatus: string; updatedAt: string; currentDraftVersionId: string | null; currentPublishedVersionId: string | null;
}
interface MemberRow { id: string; userId: string; organizationId: string; role: MembershipRole; status: string }
interface VersionRow { id: string; productId: string; organizationId: string; versionNumber: number | null; status: string; sourceLocale: string; updatedAt: string }
interface ImageRow extends Omit<ImageAsset, "sizeBytes"> { sizeBytes: string | number; state: string; policyVersion: number }
interface Candidate { product: ProductRow; membership: MemberRow; imageId: string }
interface DocumentRow { id: string; originalFilename: string; mimeType: string; sizeBytes: string | number;
  checksumSha256: string; storageProvider: string; storageBucket: string; storageKey: string; status: string }
function requireRecovery(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function uuid(value: string) { requireRecovery(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), "RECOVERY_UUID"); return `'${value}'::uuid`; }
const deny = (): never => { throw new Error("RECOVERY_WRITE_OR_PUBLIC_PATH_FORBIDDEN"); };

export async function runRecoveryRead(config: RecoveryConfig, ports: Ports) {
  requireRecovery(config.database === "passvero_staging_recovery", "RECOVERY_DATABASE_SCOPE");
  const candidate = ports.query<Candidate | null>(`/* recovery:candidate */ SELECT json_build_object('product',row_to_json(p),'membership',row_to_json(m),'imageId',i.id)
    FROM "Product" p JOIN "ProductVersion" v ON v."productId"=p.id AND v."organizationId"=p."organizationId"
    JOIN "ProductImage" i ON i."productVersionId"=v.id JOIN "ProductImageAsset" a ON a.id=i."assetId" AND a."organizationId"=p."organizationId"
    JOIN "Membership" m ON m."organizationId"=p."organizationId" AND m.status='ACTIVE'
    WHERE p."lifecycleStatus"='ACTIVE' AND v.id IN (p."currentDraftVersionId",p."currentPublishedVersionId")
    AND a.state='READY' AND a."policyVersion"=1 ORDER BY p.id,i.id,m.id LIMIT 1`);
  requireRecovery(candidate, "NO_RESTORED_PRODUCT_IMAGE_MEMBERSHIP");
  const productId = uuid(candidate.product.id);
  const organizationId = uuid(candidate.product.organizationId);
  const membershipId = uuid(candidate.membership.id);
  const userId = uuid(candidate.membership.userId);
  requireRecovery(candidate.membership.organizationId === candidate.product.organizationId
    && candidate.membership.status === "ACTIVE" && ["VIEWER", "EDITOR", "ADMIN", "OWNER"].includes(candidate.membership.role), "RECOVERY_MEMBERSHIP");
  const context: AuthenticatedUserContext = { userId: candidate.membership.userId,
    organizationId: candidate.product.organizationId, membershipId: candidate.membership.id,
    membershipRole: candidate.membership.role, membershipStatus: "ACTIVE",
    permissions: permissionsForMembershipRole(candidate.membership.role), correlationId: "isolated-recovery-read" };
  const actor = () => {
    const count = ports.query<number>(`/* recovery:actor */ SELECT count(*) FROM "Membership" WHERE id=${membershipId}
      AND "userId"=${userId} AND "organizationId"=${organizationId} AND status='ACTIVE' AND role='${candidate.membership.role}'`);
    requireRecovery(count === 1, "RECOVERY_ACTOR_CHANGED");
  };
  const bytesFor = (identity: { storageProvider: string; storageBucket: string; storageKey: string; sizeBytes: string | number; checksumSha256: string }) => {
    requireRecovery(identity.storageProvider === "supabase", "RECOVERY_STORAGE_PROVIDER");
    const matches = config.objects.filter(o => o.bucket === identity.storageBucket && o.key === identity.storageKey);
    requireRecovery(matches.length === 1, "RECOVERY_OBJECT_NOT_STORED");
    const object = matches[0]!;
    requireRecovery(["passvero-staging-documents", "passvero-staging-images"].includes(object.bucket)
      && object.file === createHash("sha256").update(object.bucket + "\0" + object.key).digest("hex")
      && object.size === Number(identity.sizeBytes) && object.sha256 === identity.checksumSha256, "RECOVERY_OBJECT_IDENTITY");
    const file = path.join(config.source, "storage", "objects", object.bucket, object.file);
    const bytes = ports.readFile(file);
    requireRecovery(bytes.byteLength === object.size && sha256(bytes) === object.sha256, "RECOVERY_OBJECT_CHECKSUM");
    return bytes;
  };
  const exportProduct = createExportCatalog({ async readSnapshot(org, search, consume) {
    requireRecovery(org === context.organizationId && search === "", "RECOVERY_PRODUCT_SCOPE"); actor();
    const row = ports.query<ProductRow | null>(`/* recovery:product */ SELECT row_to_json(p) FROM "Product" p WHERE id=${productId} AND "organizationId"=${organizationId}`);
    requireRecovery(row, "RECOVERY_PRODUCT_MISSING");
    const loadVersion = (id: string | null): CatalogVersion | null => {
      if (!id) return null;
      const versionId = uuid(id);
      const v = ports.query<VersionRow | null>(`/* recovery:version */ SELECT row_to_json(v) FROM "ProductVersion" v WHERE id=${versionId} AND "productId"=${productId} AND "organizationId"=${organizationId}`);
      requireRecovery(v, "RECOVERY_VERSION_MISSING");
      const identifiers = ports.query<CatalogVersion["identifiers"]>(`/* recovery:identifiers */ SELECT coalesce(json_agg(json_build_object('type',type,'value',value,'nomenclatureYear',"nomenclatureYear") ORDER BY type,value),'[]'::json) FROM "ProductIdentifier" WHERE "productVersionId"=${versionId}`);
      const manufacturer = ports.query<CatalogVersion["manufacturer"]>(`/* recovery:manufacturer */ SELECT json_build_object('organizationId',"organizationId",'name',name,'countryCode',"countryCode") FROM "ProductVersionManufacturer" WHERE "productVersionId"=${versionId}`);
      return { ...v, updatedAt: new Date(v.updatedAt), identifiers, manufacturer };
    };
    const record: CatalogRecord = { ...row, updatedAt: new Date(row.updatedAt),
      currentDraftVersion: loadVersion(row.currentDraftVersionId), currentPublishedVersion: loadVersion(row.currentPublishedVersionId) };
    await consume([record]);
  } });
  const csv = await exportProduct("", context);
  requireRecovery(csv.byteLength > 0 && new TextDecoder().decode(csv).includes(candidate.product.id), "RECOVERY_PRODUCT_READ");
  const imageServices = createImageServices({ normalize: deny,
    persistence: { get: deny, check: deny, reserve: deny, finalize: deny, abandon: deny, publicAsset: deny,
      async privateAsset(id, imageId, ctx) {
        requireRecovery(id === candidate.product.id && ctx.organizationId === context.organizationId, "RECOVERY_IMAGE_SCOPE"); actor();
        const image = ports.query<ImageRow | null>(`/* recovery:image */ SELECT row_to_json(a) FROM "Product" p
          JOIN "ProductVersion" v ON v."productId"=p.id AND v."organizationId"=p."organizationId"
          JOIN "ProductImage" i ON i."productVersionId"=v.id JOIN "ProductImageAsset" a ON a.id=i."assetId" AND a."organizationId"=p."organizationId"
          WHERE p.id=${productId} AND p."organizationId"=${organizationId} AND i.id=${uuid(imageId)}
          AND v.id IN (p."currentDraftVersionId",p."currentPublishedVersionId")`);
        requireRecovery(image && image.state === "READY" && image.policyVersion === 1
          && ["image/jpeg", "image/png"].includes(image.mimeType) && Number(image.sizeBytes) > 0
          && Number(image.sizeBytes) <= 8 * 1024 * 1024, "RECOVERY_IMAGE_STATE");
        return { ...image, sizeBytes: Number(image.sizeBytes) };
      } },
    storage: { identity: deny, put: deny, remove: deny, async read(asset) { return bytesFor(asset); } } });
  const image = await imageServices.download({ productId: candidate.product.id, context }, candidate.imageId);
  const document = ports.query<DocumentRow | null>(`/* recovery:document */ SELECT row_to_json(d) FROM "Document" d
    WHERE d.status='AVAILABLE' AND d."mimeType"='application/pdf' AND EXISTS
      (SELECT 1 FROM "ProductDocument" l JOIN "ProductVersion" v ON v.id=l."productVersionId" AND v."organizationId"=d."organizationId" WHERE l."documentId"=d.id)
    ORDER BY d.id LIMIT 1`);
  requireRecovery(document, "NO_RESTORED_LINKED_PDF");
  const original = bytesFor(document);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(original); controller.close(); } });
  const pdfBytes = await readDocumentBytes(stream);
  const pdf = validatePdf({ filename: document.originalFilename, mimeType: document.mimeType, bytes: pdfBytes });
  requireRecovery(pdf.sizeBytes === Number(document.sizeBytes) && pdf.checksumSha256 === document.checksumSha256, "RECOVERY_PDF_READ");
  return { applicationRead: "PASS_PRIVATE_RECOVERY_PORTS", product: "PASS_APPLICATION_CATALOG_EXPORT",
    pdf: "PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA", image: "PASS_APPLICATION_DOWNLOAD_AND_RECHECK",
    productCsvSha256: sha256(csv), pdfBytes: pdf.sizeBytes, pdfSha256: pdf.checksumSha256,
    imageBytes: image.sizeBytes, imageSha256: sha256(image.bytes),
    schemaWrites: "NONE", businessWrites: "NONE", smtpCalls: 0, storageProviderRestore: "NOT_PERFORMED",
    authSessionRecovery: "NOT_TESTED", freshScannerTrustRecovery: "NOT_TESTED", webServiceRecovery: "NOT_TESTED" };
}

if (require.main === module) {
  (async () => {
    const config = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as RecoveryConfig;
    requireRecovery(config.database === "passvero_staging_recovery" && /^\/var\/lib\/passvero-staging-recovery\/restore\/[0-9]{8}T[0-9]{6}Z\/socket$/.test(config.socket), "RECOVERY_SOCKET_SCOPE");
    const query: Query = <T>(sql: string): T => {
      const out = execFileSync("/usr/lib/postgresql/16/bin/psql", ["-XqAt", "-h", config.socket, "-p", "55434", "-U", "postgres", "-d", config.database,
        "-v", "ON_ERROR_STOP=1", "-c", "BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; " + sql],
        { encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024, env: { PATH: "/usr/bin:/bin", LANG: "C", PGAPPNAME: "passvero_recovery_app_read" }, stdio: ["ignore", "pipe", "pipe"] });
      return (out.trim() ? JSON.parse(out) : null) as T;
    };
    console.log(JSON.stringify(await runRecoveryRead(config, { query, readFile: file => new Uint8Array(readFileSync(file)) })));
  })().catch(() => { console.log(JSON.stringify({ applicationRead: "STOP", reason: "PRIVATE_APPLICATION_READ_FAILED" })); process.exitCode = 1; });
}
