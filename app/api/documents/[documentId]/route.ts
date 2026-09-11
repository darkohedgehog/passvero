import { documentHttpFailure } from "@/src/application/documents/http";
import { getDocumentHttpHandlers } from "@/src/infrastructure/documents/document-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }): Promise<Response> {
  try { return await getDocumentHttpHandlers().download(request, (await context.params).documentId); }
  catch (error) { return documentHttpFailure(error, request.method === "HEAD"); }
}
export const HEAD = GET;
