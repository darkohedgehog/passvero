import { z } from "zod";
import { canonicalProxyDenial, type CanonicalProxyDependencies } from "@/src/application/http/canonical-proxy";
import type { AuthenticatedUserContextResolution } from "@/src/application/context/resolve-authenticated-user-context";
import { CatalogImportError, MAX_IMPORT_BYTES } from "./contracts";
import { requireImportContext, type createCatalogImportService } from "./service";
import { parseImportFile } from "./parse";

const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
export function importFailure(error: unknown) {
  const code = error instanceof CatalogImportError ? error.code : "FAILED";
  return Response.json({ code }, { status: code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "FAILED" ? 500 : 400, headers });
}
async function readBody(request: Request, maximum: number) {
  if (!request.body) throw new CatalogImportError("FILE");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  const timer = setTimeout(() => { void reader.cancel(); }, 10_000);
  const started = performance.now();
  try {
    while (true) {
      const part = await reader.read(); if (performance.now() - started >= 10_000) throw new CatalogImportError("FILE");
      if (part.done) break; length += part.value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new CatalogImportError("FILE"); } chunks.push(part.value);
    }
    return Buffer.concat(chunks, length);
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export function createCatalogImportHandler(deps: CanonicalProxyDependencies & {
  resolveContext(headers: Headers): Promise<AuthenticatedUserContextResolution>;
  service: ReturnType<typeof createCatalogImportService>;
}) {
  return async (request: Request) => {
    const denial = canonicalProxyDenial(request, deps, "FORBIDDEN"); if (denial) return denial;
    try {
      const resolution = await deps.resolveContext(request.headers);
      if (resolution.status !== "RESOLVED") throw new CatalogImportError("FORBIDDEN");
      const context = resolution.context; requireImportContext(context);
      const query = new URL(request.url).searchParams;
      const action = z.enum(["headers", "preview", "confirm", "execute", "cancel"]).parse(query.get("action"));
      if ([...query.keys()].length !== 1) throw new CatalogImportError("VALIDATION");
      let result: unknown;
      if (action === "execute" || action === "cancel") {
        if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CatalogImportError("VALIDATION");
        const input: unknown = JSON.parse((await readBody(request, 128 * 1024)).toString("utf8"));
        result = action === "execute" ? await deps.service.execute(input, context) : await deps.service.cancel(z.object({ id: z.uuid() }).strict().parse(input).id, context);
      } else {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.startsWith("multipart/form-data;")) throw new CatalogImportError("FILE");
        const body = await readBody(request, MAX_IMPORT_BYTES + 128 * 1024);
        const form = await new Response(body, { headers: { "content-type": contentType } }).formData();
        if (form.getAll("file").length !== 1 || form.getAll("options").length !== 1 || [...form.keys()].some(k => !["file", "options", "confirmation"].includes(k))) throw new CatalogImportError("FILE");
        const file = form.get("file"), optionsText = form.get("options");
        if (!(file instanceof File) || !/\.csv$/i.test(file.name) || file.size > MAX_IMPORT_BYTES || typeof optionsText !== "string" || optionsText.length > 8192) throw new CatalogImportError("FILE");
        const bytes = new Uint8Array(await file.arrayBuffer()); const options: unknown = JSON.parse(optionsText);
        if (action === "headers") result = { headers: parseImportFile(bytes, z.object({ delimiter: z.enum([",", ";"]) }).parse(options).delimiter).headers };
        else if (action === "preview") result = await deps.service.preview(bytes, options, context);
        else {
          const confirmation = form.get("confirmation"); if (form.getAll("confirmation").length !== 1 || typeof confirmation !== "string" || confirmation.length > 100_000) throw new CatalogImportError("SELECTION");
          result = await deps.service.confirm(bytes, options, JSON.parse(confirmation), context);
        }
      }
      return Response.json(result, { headers });
    } catch (error) { return importFailure(error instanceof z.ZodError ? new CatalogImportError("VALIDATION") : error); }
  };
}
