import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import type { AuthenticatedUserContext } from "@/src/application/context/authenticated-user-context";
import { ApplicationError } from "@/src/application/errors/application-error";
import { hasProductPermission, PRODUCT_PUBLISH } from "@/src/application/permissions/product-permissions";
import type { ProductLifecycleStatus, ProductVersionStatus } from "@/src/application/products/list-products/contracts";
import type { PublishProduct, PublishProductCommand } from "@/src/application/products/publish-product/contracts";

const MAX_BODY = 2048;
const EVIDENCE = 128;

export function canShowPublishProductAction(context: AuthenticatedUserContext, lifecycleStatus: ProductLifecycleStatus, currentDraftStatus: ProductVersionStatus | null): boolean {
  return context.membershipStatus === "ACTIVE"
    && hasProductPermission(context, PRODUCT_PUBLISH)
    && lifecycleStatus === "ACTIVE"
    && (currentDraftStatus === "DRAFT" || currentDraftStatus === "READY_FOR_REVIEW");
}

export function createPublishProductHttpHandler(dependencies: { canonicalOrigin: string; resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>; publish: PublishProduct }) {
  return async (request: Request, productId: string): Promise<Response> => {
    if (!validOrigin(request, dependencies.canonicalOrigin)) return json({ status: "FORBIDDEN" }, 403);
    const payload = await readPayload(request);
    if (payload === null) return json({ status: "VALIDATION_ERROR" }, 400);
    let resolution: AuthenticatedUserContextResolution;
    try { resolution = await dependencies.resolveContext(request.headers); } catch { return json({ status: "OPERATIONAL_FAILURE" }, 503); }
    if (resolution.status !== "RESOLVED") return json({ status: "FORBIDDEN" }, 403);
    try {
      const result = await dependencies.publish({ productId, ...payload }, resolution.context);
      return json({ status: result.status, versionNumber: result.versionNumber }, 200);
    } catch (error) { return mapError(error); }
  };
}

type Payload = Omit<PublishProductCommand, "productId">;
async function readPayload(request: Request): Promise<Payload | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return null;
  let text: string;
  try { text = await request.text(); } catch { return null; }
  if (text.length === 0 || text.length > MAX_BODY) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!record(value)) return null;
  const keys = ["expectedDraftVersionId", "expectedProductUpdatedAt", "expectedDraftUpdatedAt", "expectedCurrentPublishedVersionId"];
  if (Object.keys(value).length !== keys.length || !Object.keys(value).every((key) => keys.includes(key)) || !keys.every((key) => key in value)) return null;
  if (!bounded(value.expectedDraftVersionId) || !bounded(value.expectedProductUpdatedAt) || !bounded(value.expectedDraftUpdatedAt) || !(value.expectedCurrentPublishedVersionId === null || bounded(value.expectedCurrentPublishedVersionId))) return null;
  return { expectedDraftVersionId: value.expectedDraftVersionId, expectedProductUpdatedAt: value.expectedProductUpdatedAt, expectedDraftUpdatedAt: value.expectedDraftUpdatedAt, expectedCurrentPublishedVersionId: value.expectedCurrentPublishedVersionId };
}

function mapError(error: unknown): Response {
  if (!(error instanceof ApplicationError)) return json({ status: "OPERATIONAL_FAILURE" }, 503);
  if (error.code === "PUBLISH_PRODUCT_STALE_WRITE") return json({ status: "STALE_WRITE" }, 409);
  if (error.code === "PUBLISH_PRODUCT_NOT_READY_SOURCE_TRANSLATION") return json({ status: "NOT_READY", reason: "SOURCE_TRANSLATION" }, 409);
  if (error.code === "PUBLISH_PRODUCT_NOT_READY_PRODUCT_NAME") return json({ status: "NOT_READY", reason: "PRODUCT_NAME" }, 409);
  if (error.code === "PUBLISH_PRODUCT_NOT_READY_PUBLIC_ASSET") return json({ status: "NOT_READY", reason: "PUBLIC_ASSET" }, 409);
  if (error.code === "PUBLISH_PRODUCT_INVALID_STATE") return json({ status: "INVALID_STATE" }, 409);
  if (error.code === "PUBLISH_PRODUCT_NOT_FOUND") return json({ status: "NOT_FOUND" }, 404);
  if (error.code === "PUBLISH_PRODUCT_VALIDATION_ERROR") return json({ status: "VALIDATION_ERROR" }, 400);
  if (error.category === "UNAUTHENTICATED" || error.category === "FORBIDDEN") return json({ status: "FORBIDDEN" }, error.category === "UNAUTHENTICATED" ? 401 : 403);
  return json({ status: "OPERATIONAL_FAILURE" }, 503);
}

function validOrigin(request: Request, origin: string) { try { return request.method === "POST" && request.headers.get("origin") === origin && new URL(request.url).origin === origin; } catch { return false; } }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function bounded(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= EVIDENCE; }
function json(body: unknown, status: number) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
