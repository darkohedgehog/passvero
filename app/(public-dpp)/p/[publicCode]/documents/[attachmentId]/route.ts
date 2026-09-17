import { getPublicDocumentHttpHandler } from "@/src/infrastructure/public-dpp/public-document-runtime";
import { publicDocumentFailure } from "@/src/application/public-dpp/document-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function GET(request: Request, context: { params: Promise<{ publicCode: string; attachmentId: string }> }) {
  try {
    const { publicCode, attachmentId } = await context.params;
    return await getPublicDocumentHttpHandler()(request, publicCode, attachmentId);
  } catch (e) { return publicDocumentFailure(e, request.method === "HEAD"); }
}
export const HEAD = GET;
