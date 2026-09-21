import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { CatalogExportError, type ExportCatalog } from "./contracts";

const safeHeaders = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
export function catalogExportFailure(error: unknown): Response {
  const code = error instanceof CatalogExportError ? error.code : "FAILED";
  return Response.json({ code }, { status: code === "FORBIDDEN" ? 403 : code === "INVALID_SEARCH" ? 400 : code === "LIMIT" ? 422 : 500, headers: safeHeaders });
}
export function createCatalogExportHandler(dependencies: {
  resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
  exportCatalog: ExportCatalog;
}) {
  return async (request: Request): Promise<Response> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    try {
      const operation = async () => {
        const context = await dependencies.resolveContext(request.headers);
        if (expired) throw new CatalogExportError("LIMIT");
        if (context.status !== "RESOLVED") throw new CatalogExportError("FORBIDDEN");
        const params = new URL(request.url).searchParams;
        // A list cursor is intentionally ignored: every export starts at the beginning.
        if (params.getAll("q").length > 1 || [...params.keys()].some(key => !["q", "cursor"].includes(key))) throw new CatalogExportError("INVALID_SEARCH");
        const body = await dependencies.exportCatalog(params.get("q"), context.context);
        return new Response(body, { headers: { ...safeHeaders, "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="passvero-catalog-v1.csv"', "content-length": String(body.byteLength) } });
      };
      return await Promise.race([operation(), new Promise<Response>((_resolve, reject) => {
        timer = setTimeout(() => { expired = true; reject(new CatalogExportError("LIMIT")); }, 25_000);
      })]);
    } catch (error) { return catalogExportFailure(error); }
    finally { clearTimeout(timer); }
  };
}
