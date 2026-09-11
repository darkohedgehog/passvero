import { documentHttpFailure } from "@/src/application/documents/http";
import { getDocumentHttpHandlers } from "@/src/infrastructure/documents/document-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export async function POST(request: Request): Promise<Response> {
  try { return await getDocumentHttpHandlers().upload(request); }
  catch (error) { return documentHttpFailure(error); }
}
