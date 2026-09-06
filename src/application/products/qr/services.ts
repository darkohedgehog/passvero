import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { hasProductPermission, PRODUCT_READ, QRCODE_ACTIVATE, roleHasProductPermission, type ProductPermission } from "@/src/application/permissions/product-permissions";
import { isPassveroLocale } from "@/src/domain/values/passvero-locale";
import type { ActivateProductQr, GetProductQr, RenderProductQrArtifact } from "./contracts";
import { ProductQrError, protectQrOperation } from "./errors";
import type { ProductQrDependencies, QrRecord, QrTransactionMode } from "./ports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status: ConstructorParameters<typeof ProductQrError>[0]): never => { throw new ProductQrError(status); };

export function createProductQrServices<Transaction>(dependencies: ProductQrDependencies<Transaction>): {
  get: GetProductQr; activate: ActivateProductQr; render: RenderProductQrArtifact;
} {
  function authorize(productId: string, context: AuthenticatedUserContext | null, permission: ProductPermission): AuthenticatedUserContext {
    if (context === null) return fail("UNAUTHENTICATED");
    if (context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, permission)) return fail("FORBIDDEN");
    if (typeof productId !== "string" || !UUID.test(productId)) return fail("VALIDATION");
    return context;
  }
  async function resolve(tx: Transaction, productId: string, context: AuthenticatedUserContext, mode: QrTransactionMode) {
    const permission = mode === "ACTIVATE" ? QRCODE_ACTIVATE : PRODUCT_READ;
    const eligibility = await dependencies.persistence.readEligibility(tx, context, mode);
    if (eligibility === null || eligibility.membershipStatus !== "ACTIVE" || eligibility.organizationStatus !== "ACTIVE" || !roleHasProductPermission(eligibility.membershipRole, permission)) return fail("FORBIDDEN");
    const product = await dependencies.persistence.readProduct(tx, productId, context.organizationId, mode);
    if (product === null) return fail("NOT_FOUND");
    if (product.id !== productId || product.organizationId !== context.organizationId) return fail("OPERATIONAL_FAILURE");
    if (product.currentPublishedVersionId === null) {
      if (product.passports.length !== 0 || product.version !== null) return fail("OPERATIONAL_FAILURE");
      return null;
    }
    if (!/^[A-Za-z0-9_-]{22}$/.test(product.publicCode) || product.passports.length !== 1) return fail("OPERATIONAL_FAILURE");
    const passport = product.passports[0];
    if (passport.productId !== product.id || passport.organizationId !== context.organizationId || passport.qrCodes.length !== 1) return fail("OPERATIONAL_FAILURE");
    const qr = passport.qrCodes[0];
    if (qr.passportId !== passport.id || !validQr(qr)) return fail("OPERATIONAL_FAILURE");
    const origin = new URL(dependencies.canonicalOrigin);
    if (origin.protocol !== "https:" || origin.origin !== dependencies.canonicalOrigin || origin.port || origin.username || origin.password) return fail("OPERATIONAL_FAILURE");
    if (qr.targetUrl !== new URL(`/p/${product.publicCode}`, origin).toString()) return fail("OPERATIONAL_FAILURE");
    const version = product.version;
    if (version === null || version.id !== product.currentPublishedVersionId || version.productId !== product.id || version.organizationId !== context.organizationId || version.status !== "PUBLISHED" || !isPassveroLocale(version.sourceLocale)) return fail("OPERATIONAL_FAILURE");
    const eligible = product.lifecycleStatus === "ACTIVE" && passport.status === "ACTIVE";
    if (eligible && !await dependencies.persistence.publicEligible(tx, product.publicCode, version.sourceLocale)) return fail("OPERATIONAL_FAILURE");
    return { qr, publicCode: product.publicCode, eligible, canActivate: roleHasProductPermission(eligibility.membershipRole, QRCODE_ACTIVATE) && hasProductPermission(context, QRCODE_ACTIVATE) };
  }

  const get: GetProductQr = (query, context) => protectQrOperation(async () => {
    const trusted = authorize(query.productId, context, PRODUCT_READ);
    return dependencies.transactionRunner.run("READ", async (tx) => {
      const resolved = await resolve(tx, query.productId, trusted, "READ");
      if (resolved === null) return { kind: "NOT_PUBLISHED" };
      const available = resolved.eligible && resolved.qr.status === "ACTIVE";
      const base = `/api/products/${query.productId}/qr`;
      return {
        kind: "QR", status: resolved.qr.status,
        activationEvidence: resolved.eligible && resolved.canActivate && resolved.qr.status !== "REVOKED" ? dependencies.evidence.issue(resolved.qr) : null,
        previewUrl: available ? `${base}/preview.svg` : null,
        downloadSvgUrl: available ? `${base}.svg` : null,
        downloadPngUrl: available ? `${base}.png` : null,
      };
    });
  });

  const activate: ActivateProductQr = (command, context) => protectQrOperation(async () => {
    const trusted = authorize(command.productId, context, QRCODE_ACTIVATE);
    const claims = typeof command.activationEvidence === "string" && command.activationEvidence.length <= 512
      ? dependencies.evidence.read(command.activationEvidence) : null;
    if (claims === null) return fail("VALIDATION");
    return dependencies.transactionRunner.run("ACTIVATE", async (tx) => {
      const resolved = await resolve(tx, command.productId, trusted, "ACTIVATE");
      if (resolved === null || !resolved.eligible || resolved.qr.status === "REVOKED") return fail("INVALID_STATE");
      const current = dependencies.evidence.fingerprint(resolved.qr);
      if (claims.identity !== current.identity) return fail("STALE_WRITE");
      if (current.status === "ACTIVE") {
        // A signed prior PENDING snapshot of this immutable identity is a
        // compatible replay of the same irreversible activation objective.
        if (claims.status === "PENDING" || (claims.status === "ACTIVE" && claims.revision === current.revision)) return { status: "NO_CHANGE" };
        return fail("STALE_WRITE");
      }
      if (claims.status !== "PENDING" || claims.revision !== current.revision) return fail("STALE_WRITE");
      const at = dependencies.now();
      if (!Number.isFinite(at.getTime()) || at < resolved.qr.generatedAt || at <= resolved.qr.updatedAt) return fail("OPERATIONAL_FAILURE");
      if (!await dependencies.persistence.activate(tx, { qr: resolved.qr, at, context: trusted })) return fail("STALE_WRITE");
      return { status: "ACTIVATED" };
    });
  });

  const render: RenderProductQrArtifact = (query, context) => protectQrOperation(async () => {
    const trusted = authorize(query.productId, context, PRODUCT_READ);
    if (query.format !== "SVG" && query.format !== "PNG") return fail("VALIDATION");
    const resolved = await dependencies.transactionRunner.run("READ", async (tx) => {
      const row = await resolve(tx, query.productId, trusted, "READ");
      if (row === null || !row.eligible) return fail("INVALID_STATE");
      if (row.qr.status !== "ACTIVE") return fail("NOT_ACTIVE");
      return row;
    });
    // Encoding and byte transfer do not hold database locks or transactions.
    const body = await dependencies.renderer.render(resolved.qr.targetUrl, query.format);
    return {
      body,
      contentType: query.format === "SVG" ? "image/svg+xml; charset=utf-8" : "image/png",
      filename: `passvero-${resolved.publicCode}.${query.format.toLowerCase()}`,
    };
  });
  return { get, activate, render };
}

function validQr(qr: QrRecord): boolean {
  if (!/^[A-Z0-9_-]{8,128}$/.test(qr.code)) return false;
  for (const date of [qr.generatedAt, qr.createdAt, qr.updatedAt, qr.activatedAt, qr.revokedAt]) {
    if (date !== null && !Number.isFinite(date.getTime())) return false;
  }
  if (qr.status === "PENDING") return qr.activatedAt === null && qr.revokedAt === null;
  if (qr.status === "ACTIVE") return qr.activatedAt !== null && qr.activatedAt >= qr.generatedAt && qr.revokedAt === null;
  return qr.status === "REVOKED" && qr.activatedAt !== null && qr.revokedAt !== null && qr.activatedAt >= qr.generatedAt && qr.revokedAt >= qr.activatedAt;
}
